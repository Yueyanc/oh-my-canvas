import { createHash, randomUUID } from "node:crypto";
import {
  cosineSimilarity,
  createEmbeddingProvider,
  vectorHash,
  type EmbeddingProvider,
  type EmbeddingVector
} from "./embedding";
import { fetchWithTimeout } from "./ai-http";
import type {
  AiTokenUsageRecord,
  CollectedItem,
  EvidenceAssessment,
  QualityAssessment,
  RadarRules,
  RankingAssessment,
  ScoredItem,
  ScoringHistoryItem,
  SourceConfig
} from "./types";

type ClusterInput = {
  key: string;
  title: string;
  content?: string;
  url: string;
  sourceId: string;
  sourceType: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  isCurrent: boolean;
  embedding: EmbeddingVector;
};

type Cluster = {
  fingerprint: string;
  centroid: EmbeddingVector;
  items: ClusterInput[];
};

type ScoringContext = {
  history?: ScoringHistoryItem[];
  embeddingProvider?: EmbeddingProvider;
};

type ScoringSignals = {
  relevanceScore: number;
  credibilityScore: number;
  verificationScore: number;
  freshnessScore: number;
  completenessScore: number;
  popularityScore: number;
  diversityScore: number;
};

const aggregateWeights: Record<keyof ScoringSignals, number> = {
  relevanceScore: 0.25,
  credibilityScore: 0.2,
  verificationScore: 0.2,
  freshnessScore: 0.15,
  completenessScore: 0.1,
  popularityScore: 0.07,
  diversityScore: 0.03
};

const qualityWeights: Record<keyof QualityAssessment["dimensions"], number> = {
  factuality: 0.25,
  sourceReputation: 0.2,
  evidenceStrength: 0.2,
  completeness: 0.15,
  objectivity: 0.1,
  clarity: 0.05,
  freshnessFit: 0.05
};

function normalizeText(value: string) {
  return value.toLowerCase();
}

function metricNumber(item: CollectedItem, key: string) {
  const value = item.metrics?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function itemId(url: string) {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return randomUUID();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export async function scoreItems(
  collected: CollectedItem[],
  sources: SourceConfig[],
  rules: RadarRules,
  context: ScoringContext = {}
): Promise<ScoredItem[]> {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const candidates = collected
    .map((item) => {
      const source = sourceById.get(item.sourceId);
      return source ? { item, source } : null;
    })
    .filter((entry): entry is { item: CollectedItem; source: SourceConfig } => entry !== null)
    .filter(({ item }) => !isBlocked(item, rules));

  const provider = context.embeddingProvider ?? createEmbeddingProvider();
  const currentVectors = await provider.embedMany(
    candidates.map(({ item }) => ({
      id: item.url,
      title: item.title,
      content: item.content,
      tags: matchedKeywords(item, rules),
      sourceType: item.sourceType
    }))
  );
  const history = context.history ?? [];
  const historyVectors = await provider.embedMany(
    history.map((item) => ({
      id: item.url,
      title: item.title,
      sourceType: item.sourceType
    }))
  );

  const currentInputs = candidates.map(({ item }, index) => ({
    key: item.url,
    title: item.title,
    content: item.content,
    url: item.url,
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    firstSeenAt: item.publishedAt,
    lastSeenAt: item.publishedAt,
    isCurrent: true,
    embedding: currentVectors[index] ?? []
  }));
  const historyInputs = history.map((item, index) => ({
    key: item.url,
    title: item.title,
    url: item.url,
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    firstSeenAt: item.firstSeenAt,
    lastSeenAt: item.lastSeenAt,
    isCurrent: false,
    embedding: historyVectors[index] ?? []
  }));

  const clusters = buildEventClusters(currentInputs, historyInputs);
  const clusterByUrl = new Map<string, Cluster>();
  for (const cluster of clusters) {
    for (const item of cluster.items) {
      clusterByUrl.set(item.url, cluster);
    }
  }

  const scored = candidates.map(({ item, source }, index) =>
    scoreItemWithContext(item, source, rules, currentVectors[index] ?? [], provider, clusterByUrl.get(item.url), context)
  );
  const embeddingUsage = provider.consumeTokenUsage?.() ?? [];
  if (embeddingUsage.length && scored[0]) {
    scored[0] = {
      ...scored[0],
      metrics: {
        ...(scored[0].metrics ?? {}),
        __aiTokenUsage: appendTokenUsageMany(scored[0].metrics?.__aiTokenUsage, embeddingUsage)
      }
    };
  }
  const cached = reuseCachedAiMetrics(scored, history);
  return enhanceItemsWithAiQuality(cached);
}

export async function scoreItem(item: CollectedItem, source: SourceConfig, rules: RadarRules): Promise<ScoredItem | null> {
  if (isBlocked(item, rules)) return null;
  const provider = createEmbeddingProvider();
  const [embedding] = await provider.embedMany([
    {
      id: item.url,
      title: item.title,
      content: item.content,
      tags: matchedKeywords(item, rules),
      sourceType: item.sourceType
    }
  ]);
  const scored = scoreItemWithContext(item, source, rules, embedding ?? [], provider);
  const [enhanced] = await enhanceItemsWithAiQuality([scored]);
  return enhanced ?? scored;
}

function scoreItemWithContext(
  item: CollectedItem,
  source: SourceConfig,
  rules: RadarRules,
  embedding: EmbeddingVector,
  provider: EmbeddingProvider,
  cluster?: Cluster,
  context: ScoringContext = {}
): ScoredItem {
  const tags = matchedKeywords(item, rules);
  const rankScore = scoreRank(item);
  const engagementScore = scoreEngagement(item);
  const freshnessScore = scoreFreshness(item.publishedAt);
  const sourceScore = scoreSource(source, rules);
  const keywordScore = scoreKeywords(tags, rules);
  const sameItemScore = scoreSameItem(item, context.history);
  const sameItemSeenCount = sameItemSeenCountFor(item, context.history);
  const eventClusterScore = scoreEventCluster(item, cluster);
  const persistenceScore = round1(sameItemScore * 0.35 + eventClusterScore * 0.65);
  const uniqueSourceCount = cluster ? new Set(cluster.items.map((entry) => entry.sourceId)).size : 1;
  const clusterItemCount = cluster?.items.length ?? 1;
  const averageSimilarity = cluster ? averageSimilarityToCluster(embedding, cluster, item.url) : 1;
  const relevanceScore = scoreRelevance(keywordScore, averageSimilarity, rankScore);
  const credibilityScore = scoreCredibility(sourceScore, uniqueSourceCount, cluster);
  const verificationScore = scoreVerification(uniqueSourceCount, clusterItemCount, averageSimilarity, sameItemScore);
  const completenessScore = scoreCompleteness(item);
  const popularityScore = scorePopularity(rankScore, engagementScore);
  const diversityScore = scoreDiversity(uniqueSourceCount, cluster);
  const legacyAggregateScore = scoreAggregate({
    relevanceScore,
    credibilityScore,
    verificationScore,
    freshnessScore,
    completenessScore,
    popularityScore,
    diversityScore
  });
  const quality = scoreQuality(item, source, {
    sourceScore,
    verificationScore,
    completenessScore,
    freshnessScore,
    clusterItemCount,
    uniqueSourceCount,
    averageSimilarity
  });
  const ranking = scoreRanking({
    qualityScore: quality.score,
    relevanceScore,
    freshnessScore,
    popularityScore
  });
  const evidence = buildEvidence(item, source, {
    checkedAt: new Date().toISOString(),
    cluster,
    uniqueSourceCount,
    averageSimilarity
  });
  const explanation = [
    `quality ${quality.score}`,
    `ranking ${ranking.score}`,
    `relevance ${relevanceScore}`,
    `credibility ${credibilityScore}`,
    `verification ${verificationScore}`,
    `freshness ${freshnessScore}`,
    `completeness ${completenessScore}`,
    `popularity ${popularityScore}`
  ];
  const scoreBreakdown = {
    quality,
    ranking,
    evidence,
    relevanceScore,
    credibilityScore,
    verificationScore,
    completenessScore,
    popularityScore,
    diversityScore,
    rankScore,
    engagementScore,
    freshnessScore,
    persistenceScore,
    sameItemScore,
    eventClusterScore,
    sourceScore,
    keywordScore,
    ruleScore: legacyAggregateScore,
    scoringModel: "information-aggregation-v2",
    embedding: {
      provider: provider.name,
      dimensions: embedding.length || provider.dimensions,
      vectorHash: vectorHash(embedding)
    },
    matchedKeywords: tags,
    eventCluster: {
      fingerprint: cluster?.fingerprint ?? fingerprintFromEmbedding(embedding, item.title),
      itemCount: clusterItemCount,
      uniqueSourceCount,
      averageSimilarity: round2(averageSimilarity)
    },
    sameItemSeenCount,
    explanation
  };

  return {
    ...item,
    id: itemId(item.url),
    tags,
    score: quality.score,
    metrics: {
      ...(item.metrics ?? {}),
      scoreBreakdown
    },
    scoreBreakdown
  };
}

function scoreQuality(
  item: CollectedItem,
  source: SourceConfig,
  signals: {
    sourceScore: number;
    verificationScore: number;
    completenessScore: number;
    freshnessScore: number;
    clusterItemCount: number;
    uniqueSourceCount: number;
    averageSimilarity: number;
  }
): QualityAssessment {
  const objectivity = scoreObjectivity(item);
  const clarity = scoreClarity(item);
  const factuality = scoreFactuality(signals.verificationScore, objectivity, signals.averageSimilarity);
  const dimensions = {
    factuality,
    sourceReputation: signals.sourceScore,
    evidenceStrength: signals.verificationScore,
    completeness: signals.completenessScore,
    objectivity,
    clarity,
    freshnessFit: signals.freshnessScore
  };
  const score = clamp(
    round1(
      Object.entries(qualityWeights).reduce((total, [key, weight]) => {
        return total + dimensions[key as keyof QualityAssessment["dimensions"]] * weight;
      }, 0)
    ),
    0,
    100
  );
  const flags = qualityFlags(item, source, signals, dimensions);
  return {
    score,
    confidence: scoreConfidence(signals, dimensions),
    verdict: qualityVerdict(score),
    assessmentSource: "heuristic",
    dimensions,
    flags,
    rationale: [
      `来源权重 ${signals.sourceScore}`,
      `证据强度 ${signals.verificationScore}`,
      `完整性 ${signals.completenessScore}`,
      `客观性 ${objectivity}`,
      `清晰度 ${clarity}`
    ]
  };
}

function scoreRanking(input: {
  qualityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  popularityScore: number;
}): RankingAssessment {
  const personalizationScore = 50;
  const score = clamp(
    round1(input.qualityScore * 0.5 + input.relevanceScore * 0.25 + input.freshnessScore * 0.15 + input.popularityScore * 0.1),
    0,
    100
  );
  return {
    score,
    qualityScore: input.qualityScore,
    relevanceScore: input.relevanceScore,
    freshnessScore: input.freshnessScore,
    popularityScore: input.popularityScore,
    personalizationScore
  };
}

async function enhanceItemsWithAiQuality(items: ScoredItem[]) {
  if (process.env.AI_QUALITY_ENABLED !== "true") return items;
  if (!process.env.OPENAI_API_KEY) return items;
  const maxItems = Number(process.env.AI_QUALITY_MAX_PER_RUN ?? 30);
  const limit = Number.isFinite(maxItems) ? Math.max(0, maxItems) : 30;
  if (limit === 0) return items;

  const selectedIds = new Set(
    [...items]
      .filter((item) => item.scoreBreakdown.quality.assessmentSource === "heuristic")
      .sort((a, b) => b.scoreBreakdown.ranking.score - a.scoreBreakdown.ranking.score)
      .slice(0, limit)
      .map((item) => item.id)
  );

  const enhanced: ScoredItem[] = [];
  for (const item of items) {
    if (!selectedIds.has(item.id)) {
      enhanced.push(item);
      continue;
    }
    enhanced.push(await enhanceItemWithAiQuality(item));
  }
  return enhanced;
}

function reuseCachedAiMetrics(items: ScoredItem[], history: ScoringHistoryItem[]) {
  if (!history.length) return items;
  const previousByUrl = new Map(history.map((entry) => [entry.url, parseMetrics(entry.metricsJson)]));
  return items.map((item) => {
    const previous = previousByUrl.get(item.url);
    if (!previous) return item;
    let next = reuseCachedAiQuality(item, previous);
    next = reuseCachedMetric(next, previous, "aiDiscussionDigest");
    next = reuseCachedMetric(next, previous, "aiReading");
    return next;
  });
}

function reuseCachedAiQuality(item: ScoredItem, previous: Record<string, unknown>): ScoredItem {
  const previousBreakdown = parseMetrics(previous.scoreBreakdown);
  const cachedQuality = parseMetrics(previousBreakdown.quality) as QualityAssessment | null;
  if (!cachedQuality || cachedQuality.assessmentSource === "heuristic") return item;
  if (!Number.isFinite(Number(cachedQuality.score))) return item;

  const ranking = scoreRanking({
    qualityScore: cachedQuality.score,
    relevanceScore: item.scoreBreakdown.relevanceScore,
    freshnessScore: item.scoreBreakdown.freshnessScore,
    popularityScore: item.scoreBreakdown.popularityScore
  });
  const scoreBreakdown = {
    ...item.scoreBreakdown,
    quality: cachedQuality,
    ranking,
    explanation: mergeStrings(item.scoreBreakdown.explanation, ["复用同 URL 已有 AI 质量评分"])
  };
  return {
    ...item,
    score: cachedQuality.score,
    scoreBreakdown,
    metrics: {
      ...(item.metrics ?? {}),
      scoreBreakdown
    }
  };
}

function reuseCachedMetric(item: ScoredItem, previous: Record<string, unknown>, key: "aiDiscussionDigest" | "aiReading"): ScoredItem {
  const cached = previous[key];
  if (!cached || typeof cached !== "object" || Array.isArray(cached)) return item;
  if (item.metrics?.[key]) return item;
  return {
    ...item,
    metrics: {
      ...(item.metrics ?? {}),
      [key]: cached
    }
  };
}

function parseMetrics(value: unknown): Record<string, unknown> {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function enhanceItemWithAiQuality(item: ScoredItem): Promise<ScoredItem> {
  try {
    const assessment = await requestAiQualityAssessment(item);
    if (!assessment) return item;
    return applyAiQualityAssessment(item, assessment);
  } catch {
    return item;
  }
}

type AiQualityResponse = {
  confidence?: unknown;
  dimensions?: Partial<Record<keyof QualityAssessment["dimensions"], unknown>>;
  flags?: unknown;
  rationale?: unknown;
  claims?: unknown;
  tokenUsage?: AiTokenUsageRecord;
};

async function requestAiQualityAssessment(item: ScoredItem): Promise<AiQualityResponse | null> {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an information quality assessor. Return JSON only. Do not browse. Do not invent external facts. Score only from the provided item, metadata, and evidence. Scores are 0-100. Confidence is 0-1."
        },
        {
          role: "user",
          content: JSON.stringify({
            title: item.title,
            url: item.url,
            content: item.content ?? "",
            sourceType: item.sourceType,
            author: item.author,
            publishedAt: item.publishedAt,
            tags: item.tags,
            metrics: {
              rank: metricNumber(item, "rank"),
              points: metricNumber(item, "points"),
              comments: metricNumber(item, "comments")
            },
            heuristicQuality: item.scoreBreakdown.quality,
            evidence: item.scoreBreakdown.evidence,
            requiredJson: {
              confidence: "0-1",
              dimensions: {
                factuality: "0-100",
                sourceReputation: "0-100",
                evidenceStrength: "0-100",
                completeness: "0-100",
                objectivity: "0-100",
                clarity: "0-100",
                freshnessFit: "0-100"
              },
              flags: ["short machine-readable strings"],
              rationale: ["brief Chinese reasons"],
              claims: [
                {
                  text: "main factual claim",
                  support: "unverified|single-source|multi-source|conflicting",
                  confidence: "0-1"
                }
              ]
            }
          })
        }
      ],
      temperature: 0.1
    })
  }, 45_000);
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  return {
    ...(parseJsonObject(payload.choices?.[0]?.message?.content ?? "{}") as AiQualityResponse),
    tokenUsage: normalizeUsage(payload.usage, "quality", model)
  };
}

function applyAiQualityAssessment(item: ScoredItem, assessment: AiQualityResponse): ScoredItem {
  const current = item.scoreBreakdown.quality;
  const aiDimensions = normalizeAiDimensions(assessment.dimensions, current.dimensions);
  const dimensions = blendDimensions(current.dimensions, aiDimensions);
  const score = scoreQualityDimensions(dimensions);
  const confidence = round2(clamp(((current.confidence ?? 0.4) + clampNumber(assessment.confidence, 0, 1, current.confidence)) / 2, 0, 1));
  const quality: QualityAssessment = {
    ...current,
    score,
    confidence,
    verdict: qualityVerdict(score),
    assessmentSource: "hybrid",
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    checkedAt: new Date().toISOString(),
    dimensions,
    flags: mergeStrings(current.flags, normalizeStringArray(assessment.flags)),
    rationale: mergeStrings(current.rationale, normalizeStringArray(assessment.rationale)).slice(0, 8)
  };
  const ranking = scoreRanking({
    qualityScore: quality.score,
    relevanceScore: item.scoreBreakdown.relevanceScore,
    freshnessScore: item.scoreBreakdown.freshnessScore,
    popularityScore: item.scoreBreakdown.popularityScore
  });
  const evidence: EvidenceAssessment = {
    ...item.scoreBreakdown.evidence,
    claims: normalizeAiClaims(assessment.claims, item.scoreBreakdown.evidence.claims)
  };
  const scoreBreakdown = {
    ...item.scoreBreakdown,
    quality,
    ranking,
    evidence,
    explanation: [
      `quality ${quality.score}`,
      `ranking ${ranking.score}`,
      ...item.scoreBreakdown.explanation.filter((entry) => !entry.startsWith("quality ") && !entry.startsWith("ranking "))
    ]
  };
  return {
    ...item,
    score: quality.score,
    metrics: {
      ...(item.metrics ?? {}),
      scoreBreakdown,
      __aiTokenUsage: appendTokenUsage(item.metrics?.__aiTokenUsage, assessment.tokenUsage)
    },
    scoreBreakdown
  };
}

function normalizeUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  operation: AiTokenUsageRecord["operation"],
  model: string
): AiTokenUsageRecord | undefined {
  if (!usage) return undefined;
  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens);
  return {
    operation,
    model,
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0
  };
}

function appendTokenUsage(existing: unknown, usage: AiTokenUsageRecord | undefined) {
  const usages = Array.isArray(existing) ? existing.filter((entry): entry is AiTokenUsageRecord => isTokenUsage(entry)) : [];
  return usage ? [...usages, usage] : usages;
}

function appendTokenUsageMany(existing: unknown, usage: AiTokenUsageRecord[]) {
  const usages = Array.isArray(existing) ? existing.filter((entry): entry is AiTokenUsageRecord => isTokenUsage(entry)) : [];
  return [...usages, ...usage];
}

function isTokenUsage(value: unknown): value is AiTokenUsageRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.operation === "string" && typeof record.model === "string";
}

function scoreQualityDimensions(dimensions: QualityAssessment["dimensions"]) {
  return clamp(
    round1(
      Object.entries(qualityWeights).reduce((total, [key, weight]) => {
        return total + dimensions[key as keyof QualityAssessment["dimensions"]] * weight;
      }, 0)
    ),
    0,
    100
  );
}

function blendDimensions(
  heuristic: QualityAssessment["dimensions"],
  ai: QualityAssessment["dimensions"]
): QualityAssessment["dimensions"] {
  return {
    factuality: blendScore(heuristic.factuality, ai.factuality),
    sourceReputation: blendScore(heuristic.sourceReputation, ai.sourceReputation),
    evidenceStrength: blendScore(heuristic.evidenceStrength, ai.evidenceStrength),
    completeness: blendScore(heuristic.completeness, ai.completeness),
    objectivity: blendScore(heuristic.objectivity, ai.objectivity),
    clarity: blendScore(heuristic.clarity, ai.clarity),
    freshnessFit: blendScore(heuristic.freshnessFit, ai.freshnessFit)
  };
}

function blendScore(heuristic: number, ai: number) {
  return clamp(round1(heuristic * 0.45 + ai * 0.55), 0, 100);
}

function normalizeAiDimensions(
  value: AiQualityResponse["dimensions"],
  fallback: QualityAssessment["dimensions"]
): QualityAssessment["dimensions"] {
  return {
    factuality: clampNumber(value?.factuality, 0, 100, fallback.factuality),
    sourceReputation: clampNumber(value?.sourceReputation, 0, 100, fallback.sourceReputation),
    evidenceStrength: clampNumber(value?.evidenceStrength, 0, 100, fallback.evidenceStrength),
    completeness: clampNumber(value?.completeness, 0, 100, fallback.completeness),
    objectivity: clampNumber(value?.objectivity, 0, 100, fallback.objectivity),
    clarity: clampNumber(value?.clarity, 0, 100, fallback.clarity),
    freshnessFit: clampNumber(value?.freshnessFit, 0, 100, fallback.freshnessFit)
  };
}

function normalizeAiClaims(value: unknown, fallback: EvidenceAssessment["claims"]) {
  if (!Array.isArray(value)) return fallback;
  const claims = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const object = entry as Record<string, unknown>;
      const text = typeof object.text === "string" ? object.text.trim() : "";
      if (!text) return null;
      return {
        text,
        support: normalizeSupport(object.support),
        confidence: clampNumber(object.confidence, 0, 1, 0.5)
      };
    })
    .filter((entry): entry is EvidenceAssessment["claims"][number] => entry !== null)
    .slice(0, 5);
  return claims.length ? claims : fallback;
}

function normalizeSupport(value: unknown): EvidenceAssessment["claims"][number]["support"] {
  if (value === "single-source" || value === "multi-source" || value === "conflicting" || value === "unverified") return value;
  return "unverified";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
}

function mergeStrings(a: string[], b: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of [...a, ...b]) {
    if (seen.has(value)) continue;
    seen.add(value);
    merged.push(value);
  }
  return merged;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found");
  return JSON.parse(match[0]);
}

function buildEvidence(
  item: CollectedItem,
  source: SourceConfig,
  input: {
    checkedAt: string;
    cluster?: Cluster;
    uniqueSourceCount: number;
    averageSimilarity: number;
  }
): EvidenceAssessment {
  const support =
    input.uniqueSourceCount >= 2 && input.averageSimilarity >= 0.65
      ? "multi-source"
      : input.uniqueSourceCount >= 1
        ? "single-source"
        : "unverified";
  const citations = uniqueCitations(input.cluster?.items ?? []);
  return {
    sourceUrl: item.url,
    canonicalUrl: item.url,
    sourceType: item.sourceType,
    sourceId: source.id,
    author: item.author,
    checkedAt: input.checkedAt,
    claims: [
      {
        text: item.title,
        support,
        confidence: support === "multi-source" ? 0.7 : 0.45
      }
    ],
    citations
  };
}

function uniqueCitations(items: ClusterInput[]) {
  const seen = new Set<string>();
  const citations: EvidenceAssessment["citations"] = [];
  for (const item of items) {
    const key = normalizeUrl(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      url: item.url,
      sourceType: item.sourceType,
      title: item.title
    });
    if (citations.length >= 5) break;
  }
  return citations;
}

function scoreAggregate(signals: ScoringSignals) {
  return clamp(
    round1(
      Object.entries(aggregateWeights).reduce((total, [key, weight]) => {
        return total + signals[key as keyof ScoringSignals] * weight;
      }, 0)
    ),
    0,
    100
  );
}

function scoreRelevance(keywordScore: number, averageSimilarity: number, rankScore: number) {
  const semanticScore = clamp(round1(averageSimilarity * 100), 0, 100);
  return clamp(round1(keywordScore * 0.45 + semanticScore * 0.35 + rankScore * 0.2), 0, 100);
}

function scoreCredibility(sourceScore: number, uniqueSourceCount: number, cluster?: Cluster) {
  const crossSourceBonus = Math.min(Math.max(uniqueSourceCount - 1, 0) * 10, 25);
  const conflictPenalty = cluster && averageSourceAgreement(cluster) < 0.45 ? 15 : 0;
  return clamp(round1(sourceScore * 0.8 + crossSourceBonus - conflictPenalty), 0, 100);
}

function scoreVerification(uniqueSourceCount: number, clusterItemCount: number, averageSimilarity: number, sameItemScore: number) {
  return clamp(
    round1(
      (Math.min(uniqueSourceCount, 4) / 4) * 45 +
        (Math.min(clusterItemCount, 8) / 8) * 20 +
        averageSimilarity * 25 +
        sameItemScore * 0.1
    ),
    0,
    100
  );
}

function scoreCompleteness(item: CollectedItem) {
  let score = 35;
  if (item.title.length >= 12) score += 20;
  if (item.content && item.content.length >= 80) score += 25;
  else if (item.content && item.content.length >= 24) score += 15;
  if (item.author) score += 10;
  if (item.publishedAt) score += 10;
  return clamp(score, 0, 100);
}

function scorePopularity(rankScore: number, engagementScore: number) {
  return clamp(round1(rankScore * 0.45 + engagementScore * 0.55), 0, 100);
}

function scoreDiversity(uniqueSourceCount: number, cluster?: Cluster) {
  if (!cluster) return 20;
  const sourceTypeCount = new Set(cluster.items.map((item) => item.sourceType)).size;
  return clamp(round1((Math.min(uniqueSourceCount, 5) / 5) * 70 + (Math.min(sourceTypeCount, 3) / 3) * 30), 0, 100);
}

function scoreFactuality(verificationScore: number, objectivityScore: number, averageSimilarity: number) {
  return clamp(round1(verificationScore * 0.5 + objectivityScore * 0.25 + averageSimilarity * 25), 0, 100);
}

function scoreObjectivity(item: CollectedItem) {
  const text = `${item.title} ${item.content ?? ""}`.toLowerCase();
  let score = 80;
  if (/[!?]{2,}/.test(text)) score -= 12;
  if (matchesText(text, ["shocking", "insane", "crazy", "must see", "you won't believe", "爆炸", "震惊", "必看"])) score -= 18;
  if (matchesText(text, ["sponsored", "promo", "deal", "coupon", "限时", "优惠"])) score -= 18;
  if (item.title.endsWith("?")) score -= 6;
  return clamp(score, 0, 100);
}

function scoreClarity(item: CollectedItem) {
  const titleLength = item.title.trim().length;
  let score = 50;
  if (titleLength >= 16 && titleLength <= 100) score += 30;
  else if (titleLength >= 8) score += 18;
  if (item.content && item.content.replace(/<[^>]+>/g, "").trim().length >= 40) score += 15;
  if (item.url) score += 5;
  return clamp(score, 0, 100);
}

function scoreConfidence(
  signals: { clusterItemCount: number; uniqueSourceCount: number; averageSimilarity: number },
  dimensions: QualityAssessment["dimensions"]
) {
  const evidenceCoverage = Math.min(signals.uniqueSourceCount, 3) / 3;
  const clusterCoverage = Math.min(signals.clusterItemCount, 5) / 5;
  const dimensionAverage =
    Object.values(dimensions).reduce((total, value) => total + value, 0) / Math.max(Object.values(dimensions).length, 1);
  return round2(clamp(evidenceCoverage * 0.35 + clusterCoverage * 0.2 + signals.averageSimilarity * 0.25 + (dimensionAverage / 100) * 0.2, 0, 1));
}

function qualityVerdict(score: number): QualityAssessment["verdict"] {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function qualityFlags(
  item: CollectedItem,
  source: SourceConfig,
  signals: { uniqueSourceCount: number; clusterItemCount: number; verificationScore: number; completenessScore: number },
  dimensions: QualityAssessment["dimensions"]
) {
  const flags: string[] = [];
  if (signals.uniqueSourceCount <= 1) flags.push("single-source");
  if (signals.clusterItemCount <= 1) flags.push("not-cross-checked");
  if (!item.content) flags.push("no-content");
  if (!item.author) flags.push("missing-author");
  if (signals.verificationScore < 45) flags.push("weak-evidence");
  if (signals.completenessScore < 60) flags.push("incomplete");
  if (dimensions.objectivity < 65) flags.push("possible-hype-or-promo");
  if (source.type === "hackernews") flags.push("community-curated-source");
  return flags;
}

function matchesText(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function isBlocked(item: CollectedItem, rules: RadarRules) {
  const haystack = normalizeText(`${item.title} ${item.content ?? ""}`);
  return rules.blocklist.some((word) => haystack.includes(normalizeText(word)));
}

function matchedKeywords(item: CollectedItem, rules: RadarRules) {
  const haystack = normalizeText(`${item.title} ${item.content ?? ""}`);
  return rules.keywords.filter((word) => haystack.includes(normalizeText(word)));
}

function scoreRank(item: CollectedItem) {
  const rank = metricNumber(item, "rank");
  if (!rank) return 40;
  if (rank <= 1) return 100;
  if (rank <= 3) return 90;
  if (rank <= 5) return 80;
  if (rank <= 10) return 65;
  if (rank <= 20) return 45;
  if (rank <= 50) return 20;
  return 5;
}

function scoreEngagement(item: CollectedItem) {
  const weighted =
    metricNumber(item, "stars") * 1.2 +
    metricNumber(item, "points") * 1 +
    metricNumber(item, "comments") * 1.8 +
    metricNumber(item, "forks") * 2 +
    metricNumber(item, "hot") * 0.08;
  if (weighted <= 0) return 20;
  return clamp(round1(Math.log10(weighted + 1) * 25), 0, 100);
}

function scoreFreshness(publishedAt?: string) {
  if (!publishedAt) return 55;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const ageHours = ageMs / 1000 / 60 / 60;
  if (Number.isNaN(ageHours) || ageHours < 0) return 55;
  return clamp(round1(100 * Math.exp(-ageHours / 48)), 0, 100);
}

function scoreSource(source: SourceConfig, rules: RadarRules) {
  const weight = source.weight ?? rules.sourceWeights[source.type] ?? 1;
  return clamp(round1((weight / 10) * 100), 0, 100);
}

function scoreKeywords(tags: string[], rules: RadarRules) {
  if (rules.keywords.length === 0) return 50;
  if (tags.length === 0) return 0;
  return clamp(round1((Math.min(tags.length, 4) / 4) * 100), 0, 100);
}

function scoreSameItem(item: CollectedItem, history: ScoringHistoryItem[] = []) {
  const existing = history.find((entry) => normalizeUrl(entry.url) === normalizeUrl(item.url));
  if (!existing) return 0;

  const seenCount = sameItemSeenCountFor(item, history);
  const firstSeenAt = new Date(existing.firstSeenAt).getTime();
  const lastSeenAt = Date.now();
  const activeHours = Number.isNaN(firstSeenAt) ? 0 : Math.max(0, (lastSeenAt - firstSeenAt) / 1000 / 60 / 60);
  const seenCountScore = (Math.min(seenCount, 8) / 8) * 50;
  const durationScore = (Math.min(activeHours, 24) / 24) * 30;
  const rank = metricNumber(item, "rank");
  const rankTrajectoryScore = rank ? Math.max(0, 20 - Math.max(rank - 1, 0)) : 10;

  return clamp(round1(seenCountScore + durationScore + rankTrajectoryScore), 0, 100);
}

function sameItemSeenCountFor(item: CollectedItem, history: ScoringHistoryItem[] = []) {
  const existing = history.find((entry) => normalizeUrl(entry.url) === normalizeUrl(item.url));
  if (!existing) return 1;
  const previousBreakdown = extractScoreBreakdown(existing.metricsJson);
  return Math.min((previousBreakdown?.sameItemSeenCount ?? 1) + 1, 12);
}

function scoreEventCluster(item: CollectedItem, cluster?: Cluster) {
  if (!cluster) return 0;
  const uniqueSourceCount = new Set(cluster.items.map((entry) => entry.sourceId)).size;
  const clusterItemCount = cluster.items.length;
  const current = cluster.items.find((entry) => normalizeUrl(entry.url) === normalizeUrl(item.url));
  const averageSimilarity = current ? averageSimilarityToCluster(current.embedding, cluster, current.url) : 0;
  return clamp(
    round1(
      (Math.min(uniqueSourceCount, 4) / 4) * 50 +
        (Math.min(clusterItemCount, 8) / 8) * 25 +
        averageSimilarity * 25
    ),
    0,
    100
  );
}

function buildEventClusters(current: ClusterInput[], history: ClusterInput[]): Cluster[] {
  const allItems = [...current, ...history].filter((item) => isRecentEnough(item.lastSeenAt ?? item.firstSeenAt));
  const clusters: Cluster[] = [];

  for (const item of allItems) {
    let bestCluster: Cluster | undefined;
    let bestSimilarity = 0;
    for (const cluster of clusters) {
      const similarity = clusterSimilarity(item, cluster);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestSimilarity >= 0.48) {
      bestCluster.items.push(item);
      bestCluster.centroid = centroid(bestCluster.items.map((entry) => entry.embedding));
      bestCluster.fingerprint = bestFingerprint(bestCluster.items);
    } else {
      clusters.push({
        fingerprint: fingerprintFromEmbedding(item.embedding, item.title),
        centroid: item.embedding,
        items: [item]
      });
    }
  }

  return clusters;
}

function averageSimilarityToCluster(embedding: EmbeddingVector, cluster: Cluster, url?: string) {
  const comparable = cluster.items.filter((item) => !url || normalizeUrl(item.url) !== normalizeUrl(url));
  if (comparable.length === 0) return 1;
  const sum = comparable.reduce((total, item) => total + cosineSimilarity(embedding, item.embedding), 0);
  return sum / comparable.length;
}

function clusterSimilarity(item: ClusterInput, cluster: Cluster) {
  const vectorScore = cosineSimilarity(item.embedding, cluster.centroid);
  const lexicalScore = Math.max(...cluster.items.map((entry) => titleSimilarity(item.title, entry.title)), 0);
  return Math.max(vectorScore, lexicalScore * 0.9);
}

function titleSimilarity(a: string, b: string) {
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  return (2 * intersection) / (aTokens.size + bTokens.size);
}

function tokens(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\b(hot|breaking|latest|official|update|trend|news)\b/g, " ")
    .replace(/[热搜最新官方回应网友突发宣布发布]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const output = new Set<string>();
  for (const part of normalized.match(/[a-z0-9][a-z0-9._-]{1,}|[\u4e00-\u9fff]+/g) ?? []) {
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      if (part.length <= 2) {
        output.add(part);
      } else {
        for (let i = 0; i < part.length - 1; i += 1) output.add(part.slice(i, i + 2));
        for (let i = 0; i < part.length - 2; i += 1) output.add(part.slice(i, i + 3));
      }
    } else {
      output.add(part);
    }
  }
  return output;
}

function averageSourceAgreement(cluster: Cluster) {
  if (cluster.items.length <= 1) return 1;
  let pairs = 0;
  let total = 0;
  for (let i = 0; i < cluster.items.length; i += 1) {
    for (let j = i + 1; j < cluster.items.length; j += 1) {
      pairs += 1;
      total += cosineSimilarity(cluster.items[i]!.embedding, cluster.items[j]!.embedding);
    }
  }
  return pairs ? total / pairs : 1;
}

function centroid(vectors: EmbeddingVector[]) {
  const dimensions = Math.max(...vectors.map((vector) => vector.length), 0);
  const output = Array.from({ length: dimensions }, () => 0);
  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i += 1) output[i] += vector[i] ?? 0;
  }
  return output.map((value) => value / Math.max(vectors.length, 1));
}

function fingerprintFromEmbedding(embedding: EmbeddingVector, fallback: string) {
  if (embedding.length === 0) return createHash("sha1").update(fallback).digest("hex").slice(0, 16);
  const strongest = embedding
    .map((value, index) => ({ index, value: Math.abs(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
    .map((entry) => entry.index)
    .join("|");
  return createHash("sha1").update(strongest || fallback).digest("hex").slice(0, 16);
}

function bestFingerprint(items: ClusterInput[]) {
  const sourceDiversity = new Map<string, ClusterInput>();
  for (const item of items) {
    if (!sourceDiversity.has(item.sourceId)) sourceDiversity.set(item.sourceId, item);
  }
  return fingerprintFromEmbedding(centroid([...sourceDiversity.values()].map((item) => item.embedding)), items[0]?.title ?? "");
}

function extractScoreBreakdown(metrics: Record<string, unknown> | null | undefined) {
  const breakdown = metrics?.scoreBreakdown;
  if (!breakdown || typeof breakdown !== "object") return undefined;
  return breakdown as { sameItemSeenCount?: number };
}

function isRecentEnough(date?: string) {
  if (!date) return true;
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return true;
  return Date.now() - time <= 72 * 60 * 60 * 1000;
}

function normalizeUrl(url: string) {
  return url.trim().toLowerCase();
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(round1(number), min, max);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

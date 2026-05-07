import { createHash, randomUUID } from "node:crypto";
import type {
  CollectedItem,
  RadarRules,
  ScoredItem,
  ScoringHistoryItem,
  SourceConfig
} from "./types";

type ClusterInput = {
  key: string;
  title: string;
  url: string;
  sourceId: string;
  sourceType: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  isCurrent: boolean;
};

type Cluster = {
  fingerprint: string;
  items: ClusterInput[];
};

type ScoringContext = {
  history?: ScoringHistoryItem[];
};

const weights = {
  rank: 0.3,
  engagement: 0.2,
  freshness: 0.15,
  persistence: 0.15,
  source: 0.1,
  keyword: 0.1
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

export function scoreItems(
  collected: CollectedItem[],
  sources: SourceConfig[],
  rules: RadarRules,
  context: ScoringContext = {}
): ScoredItem[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const candidates = collected
    .map((item) => {
      const source = sourceById.get(item.sourceId);
      return source ? { item, source } : null;
    })
    .filter((entry): entry is { item: CollectedItem; source: SourceConfig } => entry !== null)
    .filter(({ item }) => !isBlocked(item, rules));

  const clusters = buildEventClusters(
    candidates.map(({ item }) => ({
      key: item.url,
      title: item.title,
      url: item.url,
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      firstSeenAt: item.publishedAt,
      lastSeenAt: item.publishedAt,
      isCurrent: true
    })),
    (context.history ?? []).map((item) => ({
      key: item.url,
      title: item.title,
      url: item.url,
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      isCurrent: false
    }))
  );
  const clusterByUrl = new Map<string, Cluster>();
  for (const cluster of clusters) {
    for (const item of cluster.items) {
      clusterByUrl.set(item.url, cluster);
    }
  }

  return candidates.map(({ item, source }) => scoreItemWithContext(item, source, rules, clusterByUrl.get(item.url), context));
}

export function scoreItem(item: CollectedItem, source: SourceConfig, rules: RadarRules): ScoredItem | null {
  if (isBlocked(item, rules)) return null;
  return scoreItemWithContext(item, source, rules);
}

function scoreItemWithContext(
  item: CollectedItem,
  source: SourceConfig,
  rules: RadarRules,
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
  const persistenceScore = round1(sameItemScore * 0.5 + eventClusterScore * 0.5);
  const ruleScore = round1(
    rankScore * weights.rank +
      engagementScore * weights.engagement +
      freshnessScore * weights.freshness +
      persistenceScore * weights.persistence +
      sourceScore * weights.source +
      keywordScore * weights.keyword
  );

  const averageSimilarity = cluster ? averageSimilarityToCluster(item.title, cluster) : 1;
  const uniqueSourceCount = cluster ? new Set(cluster.items.map((entry) => entry.sourceId)).size : 1;
  const clusterItemCount = cluster?.items.length ?? 1;
  const explanation = [
    `rank ${rankScore}`,
    `engagement ${engagementScore}`,
    `freshness ${freshnessScore}`,
    `persistence ${persistenceScore}`,
    `source ${sourceScore}`,
    `keyword ${keywordScore}`
  ];

  return {
    ...item,
    id: itemId(item.url),
    tags,
    score: ruleScore,
    metrics: {
      ...(item.metrics ?? {}),
      scoreBreakdown: {
        rankScore,
        engagementScore,
        freshnessScore,
        persistenceScore,
        sameItemScore,
        eventClusterScore,
        sourceScore,
        keywordScore,
        ruleScore,
        matchedKeywords: tags,
        eventCluster: {
          fingerprint: cluster?.fingerprint ?? fingerprint(item.title),
          itemCount: clusterItemCount,
          uniqueSourceCount,
          averageSimilarity: round2(averageSimilarity)
        },
        sameItemSeenCount,
        explanation
      }
    },
    scoreBreakdown: {
      rankScore,
      engagementScore,
      freshnessScore,
      persistenceScore,
      sameItemScore,
      eventClusterScore,
      sourceScore,
      keywordScore,
      ruleScore,
      matchedKeywords: tags,
      eventCluster: {
        fingerprint: cluster?.fingerprint ?? fingerprint(item.title),
        itemCount: clusterItemCount,
        uniqueSourceCount,
        averageSimilarity: round2(averageSimilarity)
      },
      sameItemSeenCount,
      explanation
    }
  };
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

  const previousBreakdown = extractScoreBreakdown(existing.metricsJson);
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
  const averageSimilarity = averageSimilarityToCluster(item.title, cluster);
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
      const similarity = averageSimilarityToCluster(item.title, cluster);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestSimilarity >= 0.42) {
      bestCluster.items.push(item);
      bestCluster.fingerprint = bestFingerprint(bestCluster.items);
    } else {
      clusters.push({ fingerprint: fingerprint(item.title), items: [item] });
    }
  }

  return clusters;
}

function averageSimilarityToCluster(title: string, cluster: Cluster) {
  const comparable = cluster.items.filter((item) => item.title !== title);
  if (comparable.length === 0) return 1;
  const sum = comparable.reduce((total, item) => total + titleSimilarity(title, item.title), 0);
  return sum / comparable.length;
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
  const normalized = normalizeTitle(value);
  const tokens = new Set<string>();
  for (const part of normalized.match(/[a-z0-9][a-z0-9._-]{1,}|[\u4e00-\u9fff]+/g) ?? []) {
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      if (part.length <= 2) {
        tokens.add(part);
      } else {
        for (let i = 0; i < part.length - 1; i += 1) tokens.add(part.slice(i, i + 2));
        for (let i = 0; i < part.length - 2; i += 1) tokens.add(part.slice(i, i + 3));
      }
    } else {
      tokens.add(part);
    }
  }
  return tokens;
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\b(hot|breaking|latest|official|update|trend|news)\b/g, " ")
    .replace(/[热搜最新官方回应网友突发宣布发布]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(title: string) {
  const topTokens = [...tokens(title)].slice(0, 8).join("|");
  return createHash("sha1").update(topTokens || title).digest("hex").slice(0, 16);
}

function bestFingerprint(items: ClusterInput[]) {
  const sourceDiversity = new Map<string, ClusterInput>();
  for (const item of items) {
    if (!sourceDiversity.has(item.sourceId)) sourceDiversity.set(item.sourceId, item);
  }
  return fingerprint([...sourceDiversity.values()].map((item) => item.title).join(" "));
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

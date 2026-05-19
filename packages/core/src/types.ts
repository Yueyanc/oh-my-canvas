export type SourceType = "rss" | "github" | "hackernews" | "newsnow";

export type SourceConfig = {
  id: string;
  type: SourceType;
  name: string;
  enabled: boolean;
  schedule?: "default" | "github-daily" | "github-weekly";
  weight?: number;
  url?: string;
  query?: string;
  since?: "daily" | "weekly" | "monthly";
  feed?: string;
  limit?: number;
  comments?: {
    enabled?: boolean;
    maxTopLevel?: number;
    maxDepth?: number;
    maxTotal?: number;
  };
};

export type RadarRules = {
  keywords: string[];
  blocklist: string[];
  sourceWeights: Partial<Record<SourceType, number>>;
};

export type RadarConfig = {
  rules: RadarRules;
  sources: SourceConfig[];
};

export type CollectedItem = {
  sourceId: string;
  sourceType: SourceType;
  title: string;
  url: string;
  content?: string;
  author?: string;
  publishedAt?: string;
  metrics?: Record<string, unknown>;
  raw?: unknown;
};

export type ScoredItem = CollectedItem & {
  id: string;
  score: number;
  tags: string[];
  scoreBreakdown: ScoreBreakdown;
};

export type AiTokenUsageRecord = {
  operation: "classification" | "summary" | "quality" | "discussion" | "reading" | "embedding";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type QualityAssessment = {
  score: number;
  confidence: number;
  verdict: "high" | "medium" | "low" | "unknown";
  assessmentSource: "heuristic" | "ai" | "hybrid";
  model?: string;
  checkedAt?: string;
  dimensions: {
    factuality: number;
    sourceReputation: number;
    evidenceStrength: number;
    completeness: number;
    objectivity: number;
    clarity: number;
    freshnessFit: number;
  };
  flags: string[];
  rationale: string[];
};

export type RankingAssessment = {
  score: number;
  qualityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  popularityScore: number;
  personalizationScore: number;
};

export type EvidenceAssessment = {
  sourceUrl: string;
  canonicalUrl: string;
  sourceType: string;
  sourceId: string;
  author?: string;
  checkedAt: string;
  claims: Array<{
    text: string;
    support: "unverified" | "single-source" | "multi-source" | "conflicting";
    confidence: number;
  }>;
  citations: Array<{
    url: string;
    sourceType: string;
    title?: string;
  }>;
};

export type ScoreBreakdown = {
  quality: QualityAssessment;
  ranking: RankingAssessment;
  evidence: EvidenceAssessment;
  relevanceScore: number;
  credibilityScore: number;
  verificationScore: number;
  completenessScore: number;
  popularityScore: number;
  diversityScore: number;
  rankScore: number;
  engagementScore: number;
  freshnessScore: number;
  persistenceScore: number;
  sameItemScore: number;
  eventClusterScore: number;
  sourceScore: number;
  keywordScore: number;
  ruleScore: number;
  scoringModel: string;
  embedding: {
    provider: string;
    dimensions: number;
    vectorHash: string;
  };
  matchedKeywords: string[];
  eventCluster: {
    fingerprint: string;
    itemCount: number;
    uniqueSourceCount: number;
    averageSimilarity: number;
  };
  sameItemSeenCount?: number;
  explanation: string[];
};

export type ScoringHistoryItem = {
  id: string;
  sourceId: string;
  sourceType: SourceType | string;
  title: string;
  url: string;
  firstSeenAt: string;
  lastSeenAt: string;
  metricsJson?: Record<string, unknown> | null;
};

export type CollectionResult = {
  collectedCount: number;
  insertedCount: number;
  updatedCount: number;
};

export type SourceType = "rss" | "github" | "hackernews" | "newsnow";

export type SourceConfig = {
  id: string;
  type: SourceType;
  name: string;
  enabled: boolean;
  weight?: number;
  url?: string;
  query?: string;
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

export type ScoreBreakdown = {
  rankScore: number;
  engagementScore: number;
  freshnessScore: number;
  persistenceScore: number;
  sameItemScore: number;
  eventClusterScore: number;
  sourceScore: number;
  keywordScore: number;
  ruleScore: number;
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

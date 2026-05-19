export type AuthState = {
  isAuthenticated: boolean;
  id?: string;
  username?: string;
  avatarUrl?: string | null;
};

export type AccountProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export const unauthorizedEventName = "information:unauthorized";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type OverviewItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  title: string;
  displayTitle: string | null;
  url: string;
  author: string | null;
  publishedAt: string | null;
  score: number;
  rank: number | null;
  displayRank: number | null;
  hot: number | null;
  engagement: number | null;
  metrics: Record<string, number | string>;
  summary: string | null;
  category: string | null;
  tags: string[];
  quality: {
    score: number;
    confidence: number;
    verdict: string;
    assessmentSource: string;
  } | null;
  discussion: {
    commentCount: number;
    summary: string;
    keyInsights: string[];
    risks: string[];
    featuredComments: Array<{
      id: number;
      author: string | null;
      text: string;
      reason: string;
      qualityScore: number;
      stance: string;
      url: string;
    }>;
    signals: {
      controversyScore: number;
      expertDensityScore: number;
      practicalValueScore: number;
    };
  } | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type OverviewSource = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  weight: number;
  itemCount: number;
  lastSeenAt: string | null;
  topRank: number | null;
  items: OverviewItem[];
};

export type RadarOverview = {
  generatedAt: string;
  latestRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    collectedCount: number;
    insertedCount: number;
    updatedCount: number;
    error: string | null;
  } | null;
  totals: {
    sourceCount: number;
    activeSourceCount: number;
    itemCount: number;
  };
  globalItems: OverviewItem[];
  sources: OverviewSource[];
};

export type HackerNewsReaderItem = {
  id: string;
  title: string;
  displayTitle: string | null;
  url: string;
  author: string | null;
  publishedAt: string | null;
  score: number;
  summary: string | null;
  category: string | null;
  rank: number | null;
  points: number | null;
  commentCount: number;
  feeds: string[];
  reading: {
    translatedTitle: string;
    translatedBody: string;
    keyPoints: string[];
    contextNotes: string[];
    sourceLimitations: string;
    sourceTextAvailable: boolean;
    generatedAt: string | null;
    model: string | null;
  } | null;
  discussion: {
    summary: string;
    keyInsights: string[];
    risks: string[];
    featuredComments: Array<{
      id: number;
      author: string | null;
      text: string;
      reason: string;
      qualityScore: number;
      stance: string;
      url: string;
    }>;
  } | null;
  quality: {
    score: number;
    confidence: number;
    verdict: string;
  } | null;
  commentsUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type GithubTrendingReaderItem = {
  id: string;
  title: string;
  displayTitle: string | null;
  url: string;
  author: string | null;
  publishedAt: string | null;
  score: number;
  summary: string | null;
  category: string | null;
  rank: number | null;
  period: string;
  stars: number;
  forks: number;
  currentPeriodStars: number;
  language: string | null;
  avatar: string | null;
  repository: string;
  brief: {
    chineseName: string;
    overview: string;
    highlights: string[];
    useCases: string[];
    concerns: string[];
    projectStage: string;
    sourceLimitations: string;
    generatedAt: string | null;
    model: string | null;
  } | null;
  quality: {
    score: number;
    confidence: number;
    verdict: string;
  } | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CollectRun = {
  id: string;
  status: "running" | "success" | "failed" | string;
  startedAt: string;
  finishedAt: string | null;
  collectedCount: number;
  insertedCount: number;
  updatedCount: number;
  error: string | null;
};

export type SchedulerTaskState = {
  schedule: "default" | "github-daily" | "github-weekly" | string;
  enabled: boolean;
  intervalMs: number;
  isRunning: boolean;
  hasTimer: boolean;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastError?: string;
};

export type SchedulerState = SchedulerTaskState & {
  schedules?: Record<string, SchedulerTaskState>;
};

export async function getRadarOverview(): Promise<RadarOverview> {
  const response = await authorizedFetch("/api/radar/overview?perSourceLimit=8&globalLimit=20");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "无法获取总览数据");
  return payload;
}

export async function getHackerNewsReaderItems(limit = 60): Promise<HackerNewsReaderItem[]> {
  const response = await authorizedFetch(`/api/hackernews/reader?limit=${limit}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "无法获取 Hacker News 阅读数据");
  return payload.items ?? [];
}

export async function getGithubTrendingReaderItems(period: "all" | "daily" | "weekly" = "all", limit = 60): Promise<GithubTrendingReaderItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (period !== "all") params.set("period", period);
  const response = await authorizedFetch(`/api/github/trending/reader?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "无法获取 GitHub 热榜阅读数据");
  return payload.items ?? [];
}

export async function getCollectRuns(): Promise<CollectRun[]> {
  const response = await authorizedFetch("/api/runs");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "无法获取采集记录");
  return payload.runs ?? [];
}

export async function getSchedulerState(): Promise<SchedulerState> {
  const response = await authorizedFetch("/api/scheduler");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "无法获取任务状态");
  return payload;
}

export async function triggerCollection() {
  const response = await authorizedFetch("/api/collect", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "触发采集失败");
  return payload;
}

export async function triggerGithubTrendingCollection(period: "daily" | "weekly") {
  const response = await authorizedFetch(`/api/github/trending/collect/${period}`, { method: "POST" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "触发 GitHub 热榜采集失败");
  return payload;
}

export async function getCurrentUser(): Promise<AuthState> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  const payload = await response.json();
  return accountToAuth(Boolean(payload.authenticated), payload.user);
}

export async function login(username: string, password: string): Promise<AuthState> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) throw new Error("账号或密码不正确");
  const payload = await response.json();
  return accountToAuth(true, payload.user ?? { username, avatarUrl: null });
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function getAccountProfile(): Promise<AccountProfile> {
  const response = await authorizedFetch("/api/auth/account");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "无法获取账户信息");
  return payload.user;
}

export async function updateAccountProfile(input: {
  username: string;
  avatarUrl: string | null;
}): Promise<AccountProfile> {
  const response = await authorizedFetch("/api/auth/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "保存账户信息失败");
  return payload.user;
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const response = await authorizedFetch("/api/auth/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) {
    if (payload.error === "Current password is incorrect") throw new Error("当前密码不正确");
    throw new Error(payload.error ?? "修改密码失败");
  }
}

async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent(unauthorizedEventName));
    throw new UnauthorizedError();
  }
  return response;
}

function accountToAuth(isAuthenticated: boolean, account?: Partial<AccountProfile> | null): AuthState {
  if (!isAuthenticated || !account) return { isAuthenticated: false };
  return {
    isAuthenticated: true,
    id: account.id,
    username: account.username,
    avatarUrl: account.avatarUrl ?? null
  };
}

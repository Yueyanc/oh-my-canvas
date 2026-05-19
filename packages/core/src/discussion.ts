import type { AiTokenUsageRecord, ScoredItem } from "./types";
import { fetchWithTimeout } from "./ai-http";

type HnComment = {
  id: number;
  author?: string;
  text: string;
  depth: number;
  publishedAt?: string;
  replyCount?: number;
  url: string;
};

type DiscussionDigest = {
  model: string;
  generatedAt: string;
  summary: string;
  keyInsights: string[];
  risks: string[];
  stances: Array<{
    label: string;
    summary: string;
  }>;
  featuredComments: Array<{
    id: number;
    author?: string;
    text: string;
    reason: string;
    qualityScore: number;
    stance: string;
    url: string;
  }>;
  discussionSignals: {
    controversyScore: number;
    expertDensityScore: number;
    practicalValueScore: number;
  };
  tokenUsage?: AiTokenUsageRecord;
};

export async function enrichDiscussionDigests(items: ScoredItem[]) {
  if (process.env.AI_DISCUSSION_ENABLED !== "true") return items;
  if (!process.env.OPENAI_API_KEY) return items;
  const maxItems = Number(process.env.AI_DISCUSSION_MAX_PER_RUN ?? 10);
  const limit = Number.isFinite(maxItems) ? Math.max(0, maxItems) : 10;
  if (limit === 0) return items;

  const selected = new Set(
    items
      .filter((item) => discussionComments(item).length > 0)
      .filter((item) => !hasDiscussionDigest(item))
      .sort((a, b) => b.scoreBreakdown.ranking.score - a.scoreBreakdown.ranking.score)
      .slice(0, limit)
      .map((item) => item.id)
  );

  const output: ScoredItem[] = [];
  for (const item of items) {
    if (!selected.has(item.id)) {
      output.push(item);
      continue;
    }
    output.push(await enrichItemDiscussion(item));
  }
  return output;
}

function hasDiscussionDigest(item: ScoredItem) {
  const digest = item.metrics?.aiDiscussionDigest;
  return Boolean(digest && typeof digest === "object");
}

async function enrichItemDiscussion(item: ScoredItem): Promise<ScoredItem> {
  const comments = discussionComments(item).slice(0, Number(process.env.AI_DISCUSSION_MAX_COMMENTS ?? 30));
  if (!comments.length) return item;
  const digest = await requestDiscussionDigest(item, comments);
  if (!digest) return item;
  return {
    ...item,
    metrics: {
      ...(item.metrics ?? {}),
      aiDiscussionDigest: digest,
      __aiTokenUsage: appendTokenUsage(item.metrics?.__aiTokenUsage, digest.tokenUsage)
    }
  };
}

async function requestDiscussionDigest(item: ScoredItem, comments: HnComment[]): Promise<DiscussionDigest | null> {
  try {
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
              "你是信息聚合产品的中文讨论精选编辑。必须只输出 JSON，不要 Markdown。所有用户可见字段必须使用简体中文，包括 summary、keyInsights、risks、stances、featuredComments.text、featuredComments.reason、featuredComments.stance。featuredComments.text 必须把原评论翻译或转述成自然的简体中文，不能保留英文原文；产品名、技术名、人名可以保留原文。不要编造评论里没有的信息。"
          },
          {
            role: "user",
            content: JSON.stringify({
              title: item.title,
              url: item.url,
              sourceType: item.sourceType,
              score: item.score,
              quality: item.scoreBreakdown.quality,
              comments: comments.map((comment) => ({
                id: comment.id,
                author: comment.author,
                text: comment.text,
                depth: comment.depth,
                replyCount: comment.replyCount,
                url: comment.url
              })),
              requiredJson: {
                summary: "用中文概括评论区讨论焦点，1-2句话",
                keyInsights: ["中文要点，最多5条"],
                risks: ["中文风险或局限，最多4条"],
                stances: [{ label: "中文立场标签", summary: "中文概括" }],
                featuredComments: [
                  {
                    id: "评论 id，必须来自输入",
                    reason: "中文说明为什么精选",
                    qualityScore: "0-100",
                    stance: "中文立场",
                    text: "必须用简体中文翻译或转述原评论主要内容，可适度压缩；不要输出英文原文",
                    author: "作者"
                  }
                ],
                discussionSignals: {
                  controversyScore: "0-100",
                  expertDensityScore: "0-100",
                  practicalValueScore: "0-100"
                }
              }
            })
          }
        ],
        temperature: 0.2
      })
    }, 45_000);
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const parsed = parseJsonObject(payload.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
    return {
      ...normalizeDigest(parsed, model, comments),
      tokenUsage: normalizeUsage(payload.usage, "discussion", model)
    };
  } catch {
    return null;
  }
}

function discussionComments(item: ScoredItem): HnComment[] {
  const discussion = item.metrics?.hnDiscussion;
  if (!discussion || typeof discussion !== "object") return [];
  const comments = (discussion as Record<string, unknown>).comments;
  if (!Array.isArray(comments)) return [];
  const normalized: Array<HnComment | null> = comments.map((comment) => {
      if (!comment || typeof comment !== "object") return null;
      const value = comment as Record<string, unknown>;
      const id = Number(value.id);
      const text = typeof value.text === "string" ? value.text.trim() : "";
      const url = typeof value.url === "string" ? value.url : "";
      if (!Number.isFinite(id) || !text || !url) return null;
      return {
        id,
        author: typeof value.author === "string" ? value.author : undefined,
        text,
        depth: Number.isFinite(Number(value.depth)) ? Number(value.depth) : 1,
        publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : undefined,
        replyCount: Number.isFinite(Number(value.replyCount)) ? Number(value.replyCount) : 0,
        url
      };
    });
  return normalized.filter((comment): comment is HnComment => comment !== null);
}

function normalizeDigest(value: Record<string, unknown>, model: string, comments: HnComment[]): DiscussionDigest {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  return {
    model,
    generatedAt: new Date().toISOString(),
    summary: stringValue(value.summary) ?? "评论区暂无足够信息形成可靠摘要。",
    keyInsights: stringArray(value.keyInsights).slice(0, 5),
    risks: stringArray(value.risks).slice(0, 4),
    stances: objectArray(value.stances)
      .map((stance) => ({
        label: stringValue(stance.label) ?? "其他观点",
        summary: stringValue(stance.summary) ?? ""
      }))
      .filter((stance) => stance.summary)
      .slice(0, 5),
    featuredComments: normalizeFeaturedComments(value.featuredComments, byId),
    discussionSignals: {
      controversyScore: clampNumber((value.discussionSignals as Record<string, unknown> | undefined)?.controversyScore, 0, 100, 0),
      expertDensityScore: clampNumber((value.discussionSignals as Record<string, unknown> | undefined)?.expertDensityScore, 0, 100, 0),
      practicalValueScore: clampNumber((value.discussionSignals as Record<string, unknown> | undefined)?.practicalValueScore, 0, 100, 0)
    }
  };
}

function normalizeFeaturedComments(value: unknown, comments: Map<number, HnComment>) {
  const normalized: Array<DiscussionDigest["featuredComments"][number] | null> = objectArray(value).map((entry) =>
    normalizeFeaturedComment(entry, comments)
  );
  return normalized.filter((entry): entry is DiscussionDigest["featuredComments"][number] => entry !== null).slice(0, 5);
}

function normalizeFeaturedComment(entry: Record<string, unknown>, comments: Map<number, HnComment>) {
  const id = Number(entry.id);
  const source = comments.get(id);
  if (!source) return null;
  return {
    id,
    author: source.author,
    text: stringValue(entry.text) ?? source.text,
    reason: stringValue(entry.reason) ?? "这条评论提供了有价值的补充信息。",
    qualityScore: clampNumber(entry.qualityScore, 0, 100, 50),
    stance: stringValue(entry.stance) ?? "补充观点",
    url: source.url
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(stringValue).filter((entry): entry is string => entry !== null);
}

function objectArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
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

function isTokenUsage(value: unknown): value is AiTokenUsageRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.operation === "string" && typeof record.model === "string";
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found");
  return JSON.parse(match[0]);
}

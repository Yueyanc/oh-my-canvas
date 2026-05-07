import { createHash } from "node:crypto";
import type { AiClassification } from "@information/db/schema";
import type { ScoredItem } from "./types";

export type ClassificationResult = {
  model: string;
  category: string;
  subCategory?: string | null;
  relevanceScore: number;
  isNoise: boolean;
  displayTitle?: string | null;
  summary: string;
  reason?: string | null;
  inputHash: string;
  tokenUsage?: TokenUsage;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const categories = [
  "tech",
  "ai",
  "business",
  "finance",
  "product",
  "open_source",
  "security",
  "society",
  "entertainment",
  "other"
];

export function inputHashForItem(item: ScoredItem) {
  return createHash("sha256")
    .update(JSON.stringify({ title: item.title, content: item.content ?? "", url: item.url, sourceType: item.sourceType }))
    .digest("hex");
}

export function selectClassificationCandidates(
  items: ScoredItem[],
  existing: AiClassification[],
  options: { maxItems?: number; minScore?: number } = {}
) {
  const maxItems = Number(process.env.AI_CLASSIFY_MAX_PER_RUN ?? options.maxItems ?? 120);
  const minScore = Number(process.env.AI_CLASSIFY_MIN_SCORE ?? options.minScore ?? 0);
  const existingByItemId = new Map(existing.map((entry) => [entry.itemId, entry]));

  return [...items]
    .filter((item) => item.score >= minScore)
    .filter((item) => {
      const previous = existingByItemId.get(item.id);
      if (!previous) return true;
      if (!previous.displayTitle) return true;
      if (previous.inputHash !== inputHashForItem(item)) return true;
      if (item.score >= 80 && previous.relevanceScore < 60) return true;
      return false;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Number.isFinite(maxItems) ? maxItems : 120);
}

export async function classifyItem(item: ScoredItem): Promise<ClassificationResult> {
  const inputHash = inputHashForItem(item);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ...fallbackClassify(item), inputHash };

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `You are an information-radar classifier and Chinese localization assistant. Output JSON only, no Markdown. category must be one of: ${categories.join(", ")}. Write displayTitle, summary, and reason in Simplified Chinese. displayTitle is only for UI display: translate or rewrite the original title into natural concise Chinese, preserve product names and proper nouns when useful, and never add facts not present in the input.`
        },
        {
          role: "user",
          content: JSON.stringify({
            title: item.title,
            content: item.content ?? "",
            sourceType: item.sourceType,
            score: item.score,
            tags: item.tags,
            metrics: item.metrics ?? {},
            requiredJson: {
              category: "tech|ai|business|finance|product|open_source|security|society|entertainment|other",
              subCategory: "short string or null",
              relevanceScore: "0-100",
              isNoise: "boolean",
              displayTitle: "concise Simplified Chinese title for display",
              summary: "one short Simplified Chinese sentence",
              reason: "short Chinese reason"
            }
          })
        }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) return { ...fallbackClassify(item, `AI classify failed: ${response.status}`), inputHash };

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  try {
    const parsed = parseJsonObject(payload.choices?.[0]?.message?.content ?? "{}") as Partial<ClassificationResult>;
    return {
      model,
      category: normalizeCategory(parsed.category),
      subCategory: parsed.subCategory ?? null,
      relevanceScore: clampNumber(parsed.relevanceScore, 0, 100, item.score),
      isNoise: Boolean(parsed.isNoise),
      displayTitle: cleanDisplayTitle(parsed.displayTitle) ?? fallbackDisplayTitle(item),
      summary: cleanChineseText(parsed.summary) ?? fallbackSummary(item),
      reason: cleanChineseText(parsed.reason) ?? null,
      inputHash,
      tokenUsage: normalizeUsage(payload.usage)
    };
  } catch {
    return { ...fallbackClassify(item, "AI classify returned invalid JSON"), inputHash };
  }
}

function fallbackClassify(item: ScoredItem, reason?: string): Omit<ClassificationResult, "inputHash"> {
  const text = `${item.title} ${item.content ?? ""} ${item.tags.join(" ")}`.toLowerCase();
  let category = "other";
  let subCategory: string | null = null;

  if (matches(text, ["ai", "agent", "openai", "anthropic", "deepseek", "大模型", "人工智能", "模型"])) {
    category = "ai";
    subCategory = "AI";
  } else if (matches(text, ["github", "open source", "开源", "typescript", "bun", "sqlite"])) {
    category = "open_source";
    subCategory = "Developer";
  } else if (matches(text, ["芯片", "半导体", "nvidia", "数据库", "云", "机器人", "自动驾驶"])) {
    category = "tech";
    subCategory = "Technology";
  } else if (matches(text, ["漏洞", "攻击", "安全", "cve", "breach"])) {
    category = "security";
    subCategory = "Security";
  } else if (matches(text, ["股票", "市值", "融资", "财报", "ipo", "股价"])) {
    category = "finance";
    subCategory = "Market";
  }

  return {
    model: "rule-based",
    category,
    subCategory,
    relevanceScore: Math.round(item.score),
    isNoise: item.score < 35,
    displayTitle: fallbackDisplayTitle(item),
    summary: fallbackSummary(item),
    reason: reason ?? `规则命中：根据标题、标签和评分归类；当前评分 ${item.score}`
  };
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found");
  return JSON.parse(match[0]);
}

function normalizeUsage(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined) {
  if (!usage) return undefined;
  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens);
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0
  };
}

function fallbackSummary(item: ScoredItem) {
  const content = item.content?.replace(/\s+/g, " ").trim();
  if (content) return content.length > 120 ? `${content.slice(0, 120)}...` : content;
  return item.title;
}

function fallbackDisplayTitle(item: ScoredItem) {
  return item.title;
}

function cleanDisplayTitle(value: unknown) {
  const text = cleanChineseText(value);
  if (!text) return null;
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function cleanChineseText(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeCategory(value: unknown) {
  return typeof value === "string" && categories.includes(value) ? value : "other";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return Math.round(fallback);
  return Math.min(max, Math.max(min, Math.round(number)));
}

function matches(text: string, words: string[]) {
  return words.some((word) => text.includes(word.toLowerCase()));
}

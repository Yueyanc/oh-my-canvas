import type { ScoredItem } from "./types";

export type SummaryResult = {
  summary: string;
  reason?: string | null;
  model: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export async function summarizeItem(item: ScoredItem): Promise<SummaryResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      summary: fallbackSummary(item),
      reason: fallbackReason(item),
      model: "rule-based"
    };
  }

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
          content: "You are a Chinese summarizer for an information radar. Always write in Simplified Chinese. Summarize technology and trend signals clearly and briefly."
        },
        {
          role: "user",
          content: `Title: ${item.title}\nSource: ${item.sourceType}\nContent: ${item.content ?? ""}\nMetrics: ${JSON.stringify(item.metrics ?? {})}\nPlease write one concise Simplified Chinese sentence and explain why it matters in Chinese.`
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    return {
      summary: fallbackSummary(item),
      reason: `智能摘要失败：${response.status}`,
      model: "rule-based"
    };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  return {
    summary: payload.choices?.[0]?.message?.content?.trim() || fallbackSummary(item),
    reason: fallbackReason(item),
    model,
    tokenUsage: normalizeUsage(payload.usage)
  };
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
  return `${item.title} 正在 ${item.sourceType} 来源中受到关注。`;
}

function fallbackReason(item: ScoredItem) {
  const tags = item.tags.length ? `命中关键词：${item.tags.join(", ")}` : "未命中关键词，但来源权重或热度指标较强";
  return `${tags}；当前评分 ${item.score}`;
}

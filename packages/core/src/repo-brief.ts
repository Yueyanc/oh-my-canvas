import type { AiTokenUsageRecord, ScoredItem } from "./types";
import { fetchWithTimeout } from "./ai-http";

type RepoBrief = {
  model: string;
  generatedAt: string;
  chineseName: string;
  overview: string;
  highlights: string[];
  useCases: string[];
  concerns: string[];
  projectStage: string;
  sourceLimitations: string;
  tokenUsage?: AiTokenUsageRecord;
};

const defaultMaxItems = 12;
const defaultReadmeMaxChars = 14_000;

export async function enrichGithubRepoBriefs(items: ScoredItem[]) {
  if (process.env.AI_REPO_BRIEF_ENABLED !== "true") return items;
  if (!process.env.OPENAI_API_KEY) return items;
  const maxItems = Number(process.env.AI_REPO_BRIEF_MAX_PER_RUN ?? defaultMaxItems);
  const limit = Number.isFinite(maxItems) ? Math.max(0, maxItems) : defaultMaxItems;
  if (limit === 0) return items;

  const selected = new Set(
    items
      .filter((item) => item.sourceType === "github")
      .filter((item) => !hasRepoBrief(item))
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
    output.push(await enrichItemRepoBrief(item));
  }
  return output;
}

function hasRepoBrief(item: ScoredItem) {
  const brief = item.metrics?.aiRepoBrief;
  return Boolean(brief && typeof brief === "object");
}

async function enrichItemRepoBrief(item: ScoredItem): Promise<ScoredItem> {
  const readme = await fetchReadme(item);
  const brief = await requestRepoBrief(item, readme);
  if (!brief) return item;
  return {
    ...item,
    metrics: {
      ...(item.metrics ?? {}),
      aiRepoBrief: brief,
      __aiTokenUsage: appendTokenUsage(item.metrics?.__aiTokenUsage, brief.tokenUsage)
    }
  };
}

async function fetchReadme(item: ScoredItem) {
  const repo = repoFullName(item);
  if (!repo) return "";
  const maxChars = Number(process.env.AI_REPO_BRIEF_README_MAX_CHARS ?? defaultReadmeMaxChars);
  const limit = Number.isFinite(maxChars) ? maxChars : defaultReadmeMaxChars;
  try {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${repo}/readme`, {
      headers: {
        accept: "application/vnd.github.raw",
        "user-agent": "information-radar"
      }
    }, 12_000);
    if (!response.ok) return "";
    return (await response.text()).slice(0, limit);
  } catch {
    return "";
  }
}

function repoFullName(item: ScoredItem) {
  const metricRepo = item.metrics?.repository;
  if (typeof metricRepo === "string" && metricRepo.includes("/")) return metricRepo;
  const match = item.url.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/i);
  return match?.[1] ?? null;
}

async function requestRepoBrief(item: ScoredItem, readme: string): Promise<RepoBrief | null> {
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
              "你是中文开源项目编辑。必须只输出 JSON，不要 Markdown。所有用户可见字段必须使用简体中文。你的任务是基于 GitHub 热榜数据、项目描述和 README，提前读一遍并解释这个项目大概做什么、为什么值得看、适合谁、有什么风险或限制。不要编造 README 和输入数据里没有的信息。项目名、技术名、公司名可以保留英文。"
          },
          {
            role: "user",
            content: JSON.stringify({
              repository: repoFullName(item) ?? item.title,
              url: item.url,
              title: item.title,
              description: item.content ?? "",
              metrics: item.metrics ?? {},
              readme,
              requiredJson: {
                chineseName: "中文展示标题，可保留项目英文名",
                overview: "用中文讲清这个项目大概是什么，2-4句话",
                highlights: ["中文亮点，最多6条"],
                useCases: ["中文适用场景，最多5条"],
                concerns: ["中文风险、限制或需要继续验证的点，最多5条"],
                projectStage: "中文判断项目成熟度或活跃状态",
                sourceLimitations: "中文说明本次判断基于哪些材料，以及信息是否完整"
              }
            })
          }
        ],
        temperature: 0.15
      })
    }, 60_000);
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const parsed = parseJsonObject(payload.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
    return {
      model,
      generatedAt: new Date().toISOString(),
      chineseName: stringValue(parsed.chineseName) ?? item.title,
      overview: stringValue(parsed.overview) ?? "",
      highlights: stringArray(parsed.highlights).slice(0, 6),
      useCases: stringArray(parsed.useCases).slice(0, 5),
      concerns: stringArray(parsed.concerns).slice(0, 5),
      projectStage: stringValue(parsed.projectStage) ?? "",
      sourceLimitations: stringValue(parsed.sourceLimitations) ?? (readme ? "本次说明基于 GitHub Trending 数据和 README。" : "本次没有读取到 README，只能基于热榜元数据和项目描述判断。"),
      tokenUsage: normalizeUsage(payload.usage, model)
    };
  } catch {
    return null;
  }
}

function parseJsonObject(content: string) {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function normalizeUsage(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined, model: string): AiTokenUsageRecord | undefined {
  if (!usage) return undefined;
  return {
    operation: "summary",
    model,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0
  };
}

function appendTokenUsage(existing: unknown, next: AiTokenUsageRecord | undefined) {
  const values = Array.isArray(existing) ? existing : [];
  return next ? [...values, next] : values;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(stringValue).filter((entry): entry is string => entry !== null);
}

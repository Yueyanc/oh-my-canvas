import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { chromium, type Browser } from "playwright";
import type { AiTokenUsageRecord, ScoredItem } from "./types";
import { fetchWithTimeout } from "./ai-http";

type HnComment = {
  id: number;
  author?: string;
  text: string;
  depth: number;
  replyCount?: number;
  url: string;
};

type ReadingTranslation = {
  model: string;
  generatedAt: string;
  translatedTitle: string;
  translatedBody: string;
  keyPoints: string[];
  contextNotes: string[];
  sourceLimitations: string;
  sourceTextAvailable: boolean;
  sourceTextChars: number;
  tokenUsage?: AiTokenUsageRecord;
};

const defaultArticleMaxChars = 12_000;
const defaultArticleMinChars = 800;
const defaultStaticFetchTimeoutMs = 8_000;
const defaultBrowserFetchTimeoutMs = 18_000;
let browserPromise: Promise<Browser> | null = null;

export async function enrichReadingTranslations(items: ScoredItem[]) {
  if (process.env.AI_READING_ENABLED !== "true") return items;
  if (!process.env.OPENAI_API_KEY) return items;
  const maxItems = Number(process.env.AI_READING_MAX_PER_RUN ?? 8);
  const limit = Number.isFinite(maxItems) ? Math.max(0, maxItems) : 8;
  if (limit === 0) return items;

  const selected = new Set(
    items
      .filter((item) => item.sourceType === "hackernews")
      .filter((item) => !hasReadingTranslation(item))
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
    output.push(await enrichItemReading(item));
  }
  return output;
}

function hasReadingTranslation(item: ScoredItem) {
  const reading = item.metrics?.aiReading;
  return Boolean(reading && typeof reading === "object");
}

async function enrichItemReading(item: ScoredItem): Promise<ScoredItem> {
  const maxChars = Number(process.env.AI_READING_MAX_CHARS ?? defaultArticleMaxChars);
  const articleText = await fetchArticleText(item.url, {
    maxChars: Number.isFinite(maxChars) ? maxChars : defaultArticleMaxChars
  });
  const translation = await requestReadingTranslation(item, articleText);
  if (!translation) return item;
  return {
    ...item,
    metrics: {
      ...(item.metrics ?? {}),
      aiReading: translation,
      __aiTokenUsage: appendTokenUsage(item.metrics?.__aiTokenUsage, translation.tokenUsage)
    }
  };
}

async function requestReadingTranslation(item: ScoredItem, articleText: string): Promise<ReadingTranslation | null> {
  try {
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
    const comments = discussionComments(item).slice(0, 12);
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
              "你是信息聚合产品的中文阅读全文编辑。必须只输出 JSON，不要把整个响应包成 Markdown。所有用户可见字段必须使用简体中文。translatedBody 字段必须是可直接渲染的 GitHub Flavored Markdown 字符串：用 ##/### 分节，用列表组织要点，用 ``` 包裹命令或代码，用 > 标出重要限制或原文提示。你的任务是忠实翻译和整理输入里的原文正文；不要编造原文没有的事实。技术名词、人名、公司名可以保留英文并补充中文解释。"
          },
          {
            role: "user",
            content: JSON.stringify({
              title: item.title,
              url: item.url,
              hackerNewsText: item.content ?? "",
              fetchedArticleText: articleText,
              discussionDigest: item.metrics?.aiDiscussionDigest ?? null,
              selectedComments: comments.map((comment) => ({
                id: comment.id,
                author: comment.author,
                text: comment.text,
                depth: comment.depth,
                replyCount: comment.replyCount,
                url: comment.url
              })),
              requiredJson: {
                translatedTitle: "中文标题",
                translatedBody:
                  "GitHub Flavored Markdown 中文正文。若 fetchedArticleText 存在，尽量完整翻译原文主要内容；用 ##/### 分节，不要输出一整片长段落；命令、配置、代码必须放进 fenced code block；若没有抓到原文，只能基于 HN 标题、HN 文本和评论上下文说明信息内容，并明确不要假装已读原文。",
                keyPoints: ["中文关键点，最多6条"],
                contextNotes: ["中文背景说明或读者需要知道的上下文，最多5条"],
                sourceLimitations: "中文说明本次正文来源是否完整、有哪些限制"
              }
            })
          }
        ],
        temperature: 0.1
      })
    }, 60_000);
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const parsed = parseJsonObject(payload.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
    return {
      ...normalizeTranslation(parsed, model, Boolean(articleText), articleText.length, item),
      tokenUsage: normalizeUsage(payload.usage, "reading", model)
    };
  } catch {
    return null;
  }
}

async function fetchArticleText(url: string, options: { maxChars: number }) {
  if (!/^https?:\/\//i.test(url)) return "";
  if (url.includes("news.ycombinator.com/item?id=")) return "";

  const maxChars = options.maxChars;
  const minChars = articleMinChars();
  const staticText = await fetchStaticArticleText(url, maxChars);
  if (staticText.length >= minChars || !browserFallbackEnabled()) return staticText;

  const renderedText = await fetchRenderedArticleText(url, maxChars);
  return renderedText.length > staticText.length ? renderedText : staticText;
}

async function fetchStaticArticleText(url: string, maxChars: number) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), staticFetchTimeoutMs());
    const response = await fetch(url, {
      headers: {
        accept: "text/html,text/plain;q=0.9,*/*;q=0.5",
        "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 InformationRadar/0.1"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const cleaned = contentType.includes("html") ? extractHtmlText(text, url) : text;
    return cleaned.slice(0, maxChars);
  } catch {
    return "";
  }
}

async function fetchRenderedArticleText(url: string, maxChars: number) {
  let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage({
      extraHTTPHeaders: {
        "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7"
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 InformationRadar/0.1"
    });
    await page.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === "image" || resourceType === "font" || resourceType === "media") {
        await route.abort();
        return;
      }
      await route.continue();
    });
    const timeout = browserFetchTimeoutMs();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    await page.waitForLoadState("networkidle", { timeout: Math.min(5_000, timeout) }).catch(() => undefined);
    await autoScroll(page);
    const html = await page.content();
    return extractHtmlText(html, url).slice(0, maxChars);
  } catch {
    return "";
  } finally {
    await page?.close().catch(() => undefined);
  }
}

async function getBrowser() {
  browserPromise ??= chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox"]
  });
  return browserPromise;
}

async function autoScroll(page: Awaited<ReturnType<Browser["newPage"]>>) {
  try {
    await page.evaluate(async () => {
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const step = Math.max(600, Math.floor(window.innerHeight * 0.8));
      for (let position = 0; position < height; position += step) {
        window.scrollTo(0, position);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
    });
  } catch {
    // Scrolling is only a best-effort trigger for lazy-rendered article bodies.
  }
}

function extractHtmlText(html: string, url: string) {
  const readable = extractReadableText(html, url);
  if (readable) return readable;

  const articleMatch = html.match(/<article\b[\s\S]*?<\/article>/i);
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const input = articleMatch?.[0] ?? bodyMatch?.[1] ?? html;
  return decodeHtml(
    input
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|h[1-6]|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function browserFallbackEnabled() {
  return process.env.ARTICLE_BROWSER_FALLBACK_ENABLED !== "false";
}

function articleMinChars() {
  const value = Number(process.env.ARTICLE_MIN_CHARS ?? defaultArticleMinChars);
  return Number.isFinite(value) ? Math.max(0, value) : defaultArticleMinChars;
}

function staticFetchTimeoutMs() {
  const value = Number(process.env.ARTICLE_STATIC_TIMEOUT_MS ?? defaultStaticFetchTimeoutMs);
  return Number.isFinite(value) ? Math.max(1_000, value) : defaultStaticFetchTimeoutMs;
}

function browserFetchTimeoutMs() {
  const value = Number(process.env.ARTICLE_BROWSER_TIMEOUT_MS ?? defaultBrowserFetchTimeoutMs);
  return Number.isFinite(value) ? Math.max(3_000, value) : defaultBrowserFetchTimeoutMs;
}

function extractReadableText(html: string, url: string) {
  try {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document, {
      charThreshold: 250,
      keepClasses: false
    }).parse();
    const text = article?.textContent?.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return text && text.length >= 250 ? text : "";
  } catch {
    return "";
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
        replyCount: Number.isFinite(Number(value.replyCount)) ? Number(value.replyCount) : 0,
        url
      };
    });
  return normalized.filter((comment): comment is HnComment => comment !== null);
}

function normalizeTranslation(
  value: Record<string, unknown>,
  model: string,
  sourceTextAvailable: boolean,
  sourceTextChars: number,
  item: ScoredItem
): ReadingTranslation {
  return {
    model,
    generatedAt: new Date().toISOString(),
    translatedTitle: stringValue(value.translatedTitle) ?? item.title,
    translatedBody: stringValue(value.translatedBody) ?? "暂时没有足够内容生成中文正文。",
    keyPoints: stringArray(value.keyPoints).slice(0, 6),
    contextNotes: stringArray(value.contextNotes).slice(0, 5),
    sourceLimitations:
      stringValue(value.sourceLimitations) ??
      (sourceTextAvailable ? "已抓取原文正文并生成中文译文。" : "未能抓取外部原文，只能基于 Hacker News 信息和评论上下文生成。"),
    sourceTextAvailable,
    sourceTextChars
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(stringValue).filter((entry): entry is string => entry !== null);
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

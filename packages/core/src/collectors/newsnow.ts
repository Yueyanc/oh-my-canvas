import type { CollectedItem, SourceConfig } from "../types";

type NewsNowItem = {
  id?: string | number;
  title?: unknown;
  url?: unknown;
  mobileUrl?: unknown;
  extra?: unknown;
  info?: unknown;
  hot?: unknown;
  timestamp?: unknown;
};

type NewsNowResponse = {
  status?: string;
  items?: NewsNowItem[];
  updatedTime?: string;
};

const defaultNewsNowApi = "https://newsnow.busiyi.world/api/s";

export async function collectNewsNow(source: SourceConfig): Promise<CollectedItem[]> {
  const platformId = source.query ?? source.id;
  if (!platformId) throw new Error(`NewsNow source ${source.id} requires query as platform id`);

  const apiUrl = new URL(source.url ?? defaultNewsNowApi);
  apiUrl.searchParams.set("id", platformId);
  apiUrl.searchParams.set("latest", "");

  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      Referer: "https://newsnow.busiyi.world/",
      Origin: "https://newsnow.busiyi.world",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  });
  if (!response.ok) {
    const hint =
      response.status === 403
        ? "Public NewsNow denied this request. Use a self-hosted NewsNow endpoint in source.url or disable this source."
        : "NewsNow request failed.";
    throw new Error(`NewsNow fetch failed for ${source.name}: ${response.status}. ${hint}`);
  }

  const payload = (await response.json()) as NewsNowResponse;
  if (payload.status && !["success", "cache"].includes(payload.status)) {
    throw new Error(`NewsNow returned status ${payload.status} for ${source.name}`);
  }

  const updatedTime = normalizeDate(payload.updatedTime);
  const results: CollectedItem[] = [];

  for (const [index, item] of (payload.items ?? []).entries()) {
    const title = normalizeString(item.title);
    const url = normalizeString(item.url) ?? normalizeString(item.mobileUrl);
    if (!title || !url) continue;

    results.push({
      sourceId: source.id,
      sourceType: "newsnow",
      title,
      url,
      content: normalizeString(item.extra) ?? normalizeString(item.info),
      publishedAt: normalizeDate(item.timestamp) ?? updatedTime,
      metrics: {
        rank: index + 1,
        hot: normalizeMetric(item.hot)
      },
      raw: item
    });
  }

  return results;
}

function normalizeString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number") return String(value);
  return undefined;
}

function normalizeMetric(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : value;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

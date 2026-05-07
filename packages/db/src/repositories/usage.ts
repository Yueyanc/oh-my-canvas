import { gte } from "drizzle-orm";
import type { AppDb } from "../client";
import { aiTokenUsage, type NewAiTokenUsage } from "../schema";

export async function insertAiTokenUsage(db: AppDb, values: NewAiTokenUsage[]) {
  if (values.length === 0) return;
  await db.insert(aiTokenUsage).values(values);
}

export async function getAiTokenUsageSummary(db: AppDb) {
  const windows = [
    { key: "5m", label: "5分钟", ms: 5 * 60 * 1000, bucketMs: 60 * 1000 },
    { key: "15m", label: "15分钟", ms: 15 * 60 * 1000, bucketMs: 3 * 60 * 1000 },
    { key: "30m", label: "半小时", ms: 30 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
    { key: "1h", label: "1小时", ms: 60 * 60 * 1000, bucketMs: 10 * 60 * 1000 },
    { key: "5h", label: "5小时", ms: 5 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
    { key: "12h", label: "12小时", ms: 12 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000 },
    { key: "1d", label: "1天", ms: 24 * 60 * 60 * 1000, bucketMs: 2 * 60 * 60 * 1000 },
    { key: "7d", label: "7天", ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 12 * 60 * 60 * 1000 }
  ];

  const now = Date.now();
  const maxWindowMs = Math.max(...windows.map((window) => window.ms));
  const earliest = new Date(now - maxWindowMs).toISOString();
  const usageRows = await db
    .select({
      operation: aiTokenUsage.operation,
      promptTokens: aiTokenUsage.promptTokens,
      completionTokens: aiTokenUsage.completionTokens,
      totalTokens: aiTokenUsage.totalTokens,
      createdAt: aiTokenUsage.createdAt
    })
    .from(aiTokenUsage)
    .where(gte(aiTokenUsage.createdAt, earliest));

  return windows.map((window) => summarizeWindow({ now, usageRows, window }));
}

function summarizeWindow({
  now,
  usageRows,
  window
}: {
  now: number;
  usageRows: Array<{
    operation: "classification" | "summary";
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    createdAt: string;
  }>;
  window: { key: string; label: string; ms: number; bucketMs: number };
}) {
  const sinceMs = now - window.ms;
  const since = new Date(sinceMs).toISOString();
  const scopedRows = usageRows.filter((item) => new Date(item.createdAt).getTime() >= sinceMs);
  const bucketCount = Math.ceil(window.ms / window.bucketMs);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const startMs = sinceMs + index * window.bucketMs;
    const endMs = Math.min(startMs + window.bucketMs, now);
    return {
      label: formatUsageBucketLabel(startMs, window.ms),
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      classificationTokens: 0,
      summaryTokens: 0,
      totalTokens: 0,
      calls: 0
    };
  });

  const byOperation = new Map<string, { operation: string; calls: number; totalTokens: number }>();
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  for (const item of scopedRows) {
    const createdAtMs = new Date(item.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) continue;

    const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((createdAtMs - sinceMs) / window.bucketMs)));
    const bucket = buckets[bucketIndex];
    if (!bucket) continue;

    const itemTotalTokens = Number(item.totalTokens ?? 0);
    promptTokens += Number(item.promptTokens ?? 0);
    completionTokens += Number(item.completionTokens ?? 0);
    totalTokens += itemTotalTokens;

    bucket.totalTokens += itemTotalTokens;
    bucket.calls += 1;
    if (item.operation === "summary") bucket.summaryTokens += itemTotalTokens;
    else bucket.classificationTokens += itemTotalTokens;

    const operationSummary = byOperation.get(item.operation) ?? { operation: item.operation, calls: 0, totalTokens: 0 };
    operationSummary.calls += 1;
    operationSummary.totalTokens += itemTotalTokens;
    byOperation.set(item.operation, operationSummary);
  }

  return {
    key: window.key,
    label: window.label,
    ms: window.ms,
    since,
    calls: scopedRows.length,
    promptTokens,
    completionTokens,
    totalTokens,
    buckets,
    byOperation: Array.from(byOperation.values())
  };
}

function formatUsageBucketLabel(timestamp: number, windowMs: number) {
  const date = new Date(timestamp);
  if (windowMs <= 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const day = date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const hour = date.toLocaleTimeString("zh-CN", { hour: "2-digit", hour12: false });
  return `${day} ${hour}`;
}

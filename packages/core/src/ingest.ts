import type { AppDb } from "@information/db";
import {
  finishRun,
  getAiClassifications,
  getScoringHistory,
  getSummaries,
  insertObservations,
  insertAiTokenUsage,
  startRun,
  upsertAiClassifications,
  upsertItems,
  upsertSources,
  upsertSummary
} from "@information/db";
import type { NewAiClassification, NewAiTokenUsage, NewItem, NewObservation, NewSource } from "@information/db/schema";
import { createChildLogger, errorMeta } from "@information/logger";
import { classifyItem, selectClassificationCandidates } from "./classify";
import { collectSource } from "./collectors";
import { enrichDiscussionDigests } from "./discussion";
import { enrichReadingTranslations } from "./reading";
import { enrichGithubRepoBriefs } from "./repo-brief";
import { scoreItems } from "./scoring";
import { summarizeItem } from "./summarize";
import type { AiTokenUsageRecord, CollectedItem, CollectionResult, RadarConfig } from "./types";

const log = createChildLogger("ingest");

export async function collectRadar(
  db: AppDb,
  config: RadarConfig,
  options: { schedule?: "default" | "github-daily" | "github-weekly"; sourceIds?: string[] } = {}
): Promise<CollectionResult> {
  const runId = await startRun(db);
  try {
    const now = new Date().toISOString();
    const schedule = options.schedule ?? "default";
    const sourceIds = options.sourceIds ? new Set(options.sourceIds) : null;
    const enabledSources = config.sources.filter((source) => {
      if (!source.enabled) return false;
      if (sourceIds) return sourceIds.has(source.id);
      return (source.schedule ?? "default") === schedule;
    });
    log.info("radar collection run started", { runId, sourceCount: enabledSources.length });
    await upsertSources(
      db,
      enabledSources.map<NewSource>((source) => ({
        id: source.id,
        type: source.type,
        name: source.name,
        url: source.url,
        query: source.query,
        enabled: source.enabled,
        weight: source.weight ?? config.rules.sourceWeights[source.type] ?? 1,
        createdAt: now,
        updatedAt: now
      }))
    );

    const collectedItems: CollectedItem[] = [];
    const sourceErrors: string[] = [];
    for (const source of enabledSources) {
      let collected: CollectedItem[] = [];
      try {
        log.info("source collection started", { runId, sourceId: source.id, sourceType: source.type, sourceName: source.name });
        collected = await collectSource(source);
        log.info("source collection finished", {
          runId,
          sourceId: source.id,
          sourceType: source.type,
          sourceName: source.name,
          itemCount: collected.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sourceErrors.push(`${source.name}: ${message}`);
        log.warn("source collection failed", {
          runId,
          sourceId: source.id,
          sourceType: source.type,
          sourceName: source.name,
          ...errorMeta(error)
        });
        continue;
      }
      collectedItems.push(...collected);
    }

    const urls = [...new Set(collectedItems.map((item) => item.url))];
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const [sameItemHistory, recentHistory] = await Promise.all([
      urls.length ? getScoringHistory(db, { urls, limit: urls.length }) : Promise.resolve([]),
      getScoringHistory(db, { since: threeDaysAgo, limit: 500 })
    ]);
    const historyByUrl = new Map([...sameItemHistory, ...recentHistory].map((item) => [item.url, item]));
    const scoredItems = await scoreItems(collectedItems, enabledSources, config.rules, {
      history: [...historyByUrl.values()]
    });
    const discussionEnriched = await enrichDiscussionDigests(scoredItems);
    const readingEnriched = await enrichReadingTranslations(discussionEnriched);
    const scored = await enrichGithubRepoBriefs(readingEnriched);
    log.info("items scored", { runId, collectedCount: collectedItems.length, scoredCount: scored.length });

    const tokenUsageRows: NewAiTokenUsage[] = collectPendingAiTokenUsage(scored, runId, now);

    const values = scored.map<NewItem>((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      title: item.title,
      url: item.url,
      content: item.content,
      author: item.author,
      publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : undefined,
      score: item.score,
      metricsJson: publicMetrics(item.metrics ?? {}),
      tagsJson: item.tags,
      rawJson: item.raw,
      firstSeenAt: now,
      lastSeenAt: now
    }));

    const result = await upsertItems(db, values);
    await insertObservations(
      db,
      scored.map<NewObservation>((item) => ({
        id: crypto.randomUUID(),
        itemId: item.id,
        runId,
        sourceId: item.sourceId,
        sourceType: item.sourceType,
        observedAt: now,
        rank: numericMetric(item.metrics, "rank"),
        hot: numericMetric(item.metrics, "hot"),
        engagement: item.scoreBreakdown.engagementScore,
        score: item.score,
        scoreBreakdownJson: item.scoreBreakdown,
        metricsJson: publicMetrics(item.metrics ?? {})
      }))
    );
    const scoredItemIds = scored.map((item) => item.id);
    const [existingClassifications, existingSummaries] = await Promise.all([
      getAiClassifications(db, scoredItemIds),
      getSummaries(db, scoredItemIds)
    ]);
    const classificationCandidates = selectClassificationCandidates(scored, existingClassifications);
    log.info("ai classification candidates selected", {
      runId,
      candidateCount: classificationCandidates.length,
      existingClassificationCount: existingClassifications.length
    });
    const classifiedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const classifications: NewAiClassification[] = [];
    for (const item of classificationCandidates) {
      const classification = await classifyItem(item);
      classifications.push({
        itemId: item.id,
        model: classification.model,
        category: classification.category,
        subCategory: classification.subCategory,
        relevanceScore: classification.relevanceScore,
        isNoise: classification.isNoise,
        displayTitle: classification.displayTitle,
        summary: classification.summary,
        reason: classification.reason,
        inputHash: classification.inputHash,
        classifiedAt,
        expiresAt
      });
      if (classification.tokenUsage) {
        tokenUsageRows.push({
          id: crypto.randomUUID(),
          runId,
          itemId: item.id,
          operation: "classification",
          model: classification.model,
          promptTokens: classification.tokenUsage.promptTokens,
          completionTokens: classification.tokenUsage.completionTokens,
          totalTokens: classification.tokenUsage.totalTokens,
          createdAt: classifiedAt
        });
      }
      await upsertSummary(db, {
        itemId: item.id,
        summary: classification.summary,
        reason: classification.reason,
        model: classification.model
      });
    }

    if (classifications.length) {
      await upsertAiClassifications(db, classifications);
      log.info("ai classifications saved", { runId, classificationCount: classifications.length });
    }

    const alreadySummarized = new Set([
      ...classifications.map((item) => item.itemId),
      ...existingSummaries.map((item) => item.itemId)
    ]);
    const topItems = [...scored]
      .filter((item) => !alreadySummarized.has(item.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    for (const item of topItems) {
      const summary = await summarizeItem(item);
      const { tokenUsage, ...summaryValue } = summary;
      await upsertSummary(db, { itemId: item.id, ...summaryValue });
      if (tokenUsage) {
        tokenUsageRows.push({
          id: crypto.randomUUID(),
          runId,
          itemId: item.id,
          operation: "summary",
          model: summary.model,
          promptTokens: tokenUsage.promptTokens,
          completionTokens: tokenUsage.completionTokens,
          totalTokens: tokenUsage.totalTokens,
          createdAt: new Date().toISOString()
        });
      }
    }

    if (tokenUsageRows.length) {
      await insertAiTokenUsage(db, tokenUsageRows);
      log.info("ai token usage saved", {
        runId,
        usageRows: tokenUsageRows.length,
        totalTokens: tokenUsageRows.reduce((total, row) => total + (row.totalTokens ?? 0), 0)
      });
    }

    const stats = {
      collectedCount: scored.length,
      insertedCount: result.inserted,
      updatedCount: result.updated
    };
    await finishRun(db, runId, {
      status: "success",
      ...stats,
      error: sourceErrors.length ? sourceErrors.join("\n") : undefined
    });
    log.info("radar collection run finished", { runId, ...stats, sourceErrorCount: sourceErrors.length });
    return stats;
  } catch (error) {
    await finishRun(db, runId, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    });
    log.error("radar collection run failed", { runId, ...errorMeta(error) });
    throw error;
  }
}

function numericMetric(metrics: Record<string, unknown> | undefined, key: string) {
  const value = metrics?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function collectPendingAiTokenUsage(items: Array<{ id: string; metrics?: Record<string, unknown> }>, runId: string, createdAt: string) {
  const rows: NewAiTokenUsage[] = [];
  for (const item of items) {
    const pending = item.metrics?.__aiTokenUsage;
    if (!Array.isArray(pending)) continue;
    for (const usage of pending) {
      if (!isAiTokenUsageRecord(usage)) continue;
      rows.push({
        id: crypto.randomUUID(),
        runId,
        itemId: item.id,
        operation: usage.operation,
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        createdAt
      });
    }
  }
  return rows;
}

function publicMetrics(metrics: Record<string, unknown>) {
  const { __aiTokenUsage: _pending, ...rest } = metrics;
  return {
    ...rest,
    aiDiscussionDigest: stripTokenUsage(rest.aiDiscussionDigest),
    aiReading: stripTokenUsage(rest.aiReading),
    aiRepoBrief: stripTokenUsage(rest.aiRepoBrief)
  };
}

function stripTokenUsage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { tokenUsage: _tokenUsage, ...rest } = value as Record<string, unknown>;
  return rest;
}

function isAiTokenUsageRecord(value: unknown): value is AiTokenUsageRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    isOperation(record.operation) &&
    typeof record.model === "string" &&
    Number.isFinite(Number(record.promptTokens)) &&
    Number.isFinite(Number(record.completionTokens)) &&
    Number.isFinite(Number(record.totalTokens))
  );
}

function isOperation(value: unknown): value is AiTokenUsageRecord["operation"] {
  return (
    value === "classification" ||
    value === "summary" ||
    value === "quality" ||
    value === "discussion" ||
    value === "reading" ||
    value === "embedding"
  );
}

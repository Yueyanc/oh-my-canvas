import type { AppDb } from "../client";
import { itemObservations } from "../schema";
import { getObservations } from "./observations";
import { average, round1 } from "./utils";

export async function getTrendSummaries(db: AppDb, itemIds: string[]) {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const observations = await getObservations(db, { itemIds, since, limit: itemIds.length * 30 });
  const grouped = new Map<string, typeof observations>();
  for (const observation of observations) {
    const group = grouped.get(observation.itemId) ?? [];
    group.push(observation);
    grouped.set(observation.itemId, group);
  }

  const trends = new Map<string, ReturnType<typeof calculateTrend>>();
  for (const [itemId, group] of grouped) {
    trends.set(itemId, calculateTrend(group));
  }
  return trends;
}

export function defaultTrend() {
  return {
    status: "new",
    velocity: 0,
    observationCount: 0,
    peakScore: 0,
    peakAt: null,
    firstObservedAt: null,
    lastObservedAt: null,
    rankDelta: 0,
    latestRank: null
  };
}

function calculateTrend(observations: Array<typeof itemObservations.$inferSelect>) {
  const sorted = [...observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (sorted.length === 0) return defaultTrend();
  const scores = sorted.map((item) => item.score);
  const latest = sorted.at(-1)!;
  const previous = sorted.at(-2);
  const recent = scores.slice(-3);
  const previousWindow = scores.slice(Math.max(0, scores.length - 6), Math.max(0, scores.length - 3));
  const recentAverage = average(recent);
  const previousAverage = previousWindow.length ? average(previousWindow) : previous?.score ?? recentAverage;
  const velocity = round1(recentAverage - previousAverage);
  const peak = sorted.reduce((best, item) => (item.score > best.score ? item : best), sorted[0]!);
  const rankDelta = latest.rank && previous?.rank ? previous.rank - latest.rank : 0;
  const lastSeenMinutes = (Date.now() - new Date(latest.observedAt).getTime()) / 1000 / 60;
  const status = trendStatus({
    observationCount: sorted.length,
    velocity,
    rankDelta,
    lastSeenMinutes
  });

  return {
    status,
    velocity,
    observationCount: sorted.length,
    peakScore: peak.score,
    peakAt: peak.observedAt,
    firstObservedAt: sorted[0]!.observedAt,
    lastObservedAt: latest.observedAt,
    rankDelta,
    latestRank: latest.rank
  };
}

function trendStatus(input: { observationCount: number; velocity: number; rankDelta: number; lastSeenMinutes: number }) {
  if (input.lastSeenMinutes > 180) return "expired";
  if (input.observationCount <= 1) return "new";
  if (input.velocity >= 8 || input.rankDelta >= 3) return "rising";
  if (input.velocity <= -8 || input.rankDelta <= -3) return "cooling";
  return "stable";
}

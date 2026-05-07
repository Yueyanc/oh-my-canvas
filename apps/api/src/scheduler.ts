import { collectRadar, loadRadarConfig } from "@information/core";
import { getLatestRun, type AppDb } from "@information/db";
import { createChildLogger, errorMeta } from "@information/logger";

const log = createChildLogger("scheduler");

type SchedulerState = {
  enabled: boolean;
  intervalMs: number;
  isRunning: boolean;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastError?: string;
};

type SchedulerGlobal = {
  state: SchedulerState;
  timer?: ReturnType<typeof setInterval>;
};

const defaultIntervalMs = 2 * 60 * 1000;
const configuredIntervalMs = Number(process.env.AUTO_COLLECT_INTERVAL_MS ?? defaultIntervalMs);
const globalKey = Symbol.for("information-radar.scheduler");
const schedulerGlobal = (globalThis as typeof globalThis & { [globalKey]?: SchedulerGlobal })[globalKey] ?? {
  state: {
    enabled: process.env.AUTO_COLLECT_ENABLED !== "false",
    intervalMs: Number.isFinite(configuredIntervalMs) && configuredIntervalMs >= 10_000 ? configuredIntervalMs : defaultIntervalMs,
    isRunning: false
  }
};

(globalThis as typeof globalThis & { [globalKey]?: SchedulerGlobal })[globalKey] = schedulerGlobal;

function getState() {
  return schedulerGlobal.state;
}

function setState(next: SchedulerState) {
  schedulerGlobal.state = next;
}

export function getSchedulerState() {
  return { ...getState(), hasTimer: Boolean(schedulerGlobal.timer) };
}

export async function runCollection(db: AppDb, trigger: "manual" | "scheduler") {
  const state = getState();
  if (state.isRunning) {
    log.warn("collection skipped because previous run is still active", { trigger, state });
    return {
      skipped: true,
      reason: "collection_already_running",
      trigger,
      state: getSchedulerState()
    };
  }

  if (trigger === "scheduler") {
    const latestRun = await getLatestRun(db);
    const latestStartedAt = latestRun?.startedAt ? new Date(latestRun.startedAt).getTime() : 0;
    const elapsedMs = latestStartedAt ? Date.now() - latestStartedAt : Number.POSITIVE_INFINITY;
    if (elapsedMs < state.intervalMs * 0.9) {
      log.warn("scheduled collection skipped because latest run is too recent", {
        latestRunId: latestRun?.id,
        latestStartedAt: latestRun?.startedAt,
        elapsedMs,
        intervalMs: state.intervalMs
      });
      return {
        skipped: true,
        reason: "latest_run_too_recent",
        trigger,
        state: getSchedulerState()
      };
    }
  }

  setState({
    ...state,
    isRunning: true,
    lastStartedAt: new Date().toISOString(),
    lastError: undefined
  });
  log.info("collection started", { trigger, intervalMs: getState().intervalMs });

  try {
    const config = await loadRadarConfig();
    const result = await collectRadar(db, config);
    setState({
      ...getState(),
      isRunning: false,
      lastFinishedAt: new Date().toISOString()
    });
    log.info("collection finished", { trigger, result, state });
    return { skipped: false, trigger, result, state: getSchedulerState() };
  } catch (error) {
    setState({
      ...getState(),
      isRunning: false,
      lastFinishedAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : String(error)
    });
    log.error("collection failed", { trigger, ...errorMeta(error), state });
    throw error;
  }
}

export function startAutoCollector(db: AppDb) {
  const state = getState();
  if (!state.enabled) return getSchedulerState();
  if (schedulerGlobal.timer) {
    log.info("auto collection already enabled; reusing existing timer", {
      intervalSeconds: Math.round(state.intervalMs / 1000)
    });
    return getSchedulerState();
  }

  schedulerGlobal.timer = setInterval(() => {
    runCollection(db, "scheduler").catch((error) => {
      log.error("auto collection failed", errorMeta(error));
    });
  }, state.intervalMs);

  log.info("auto collection enabled", { intervalSeconds: Math.round(state.intervalMs / 1000) });
  return getSchedulerState();
}

export function stopAutoCollector() {
  if (schedulerGlobal.timer) {
    clearInterval(schedulerGlobal.timer);
    schedulerGlobal.timer = undefined;
    log.info("auto collection stopped");
  }
  return getSchedulerState();
}

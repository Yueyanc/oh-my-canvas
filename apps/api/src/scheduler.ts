import { collectRadar, loadRadarConfig } from "@information/core";
import { getLatestRun, type AppDb } from "@information/db";
import { createChildLogger, errorMeta } from "@information/logger";

const log = createChildLogger("scheduler");

type SchedulerState = {
  enabled: boolean;
  intervalMs: number;
  isRunning: boolean;
  schedule: "default" | "github-daily" | "github-weekly";
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastError?: string;
};

type SchedulerGlobal = {
  states: Record<"default" | "github-daily" | "github-weekly", SchedulerState>;
  timers: Partial<Record<"default" | "github-daily" | "github-weekly", ReturnType<typeof setInterval>>>;
};

const defaultIntervalMs = 12 * 60 * 60 * 1000;
const configuredIntervalMs = Number(process.env.AUTO_COLLECT_INTERVAL_MS ?? defaultIntervalMs);
const dayMs = 24 * 60 * 60 * 1000;
const weekMs = 7 * dayMs;
const globalKey = Symbol.for("information-radar.scheduler");
const existingSchedulerGlobal = (globalThis as typeof globalThis & { [globalKey]?: SchedulerGlobal | { state?: SchedulerState; timer?: ReturnType<typeof setInterval> } })[globalKey];
const schedulerGlobal: SchedulerGlobal = isSchedulerGlobal(existingSchedulerGlobal) ? existingSchedulerGlobal : {
  states: {
    default: {
      schedule: "default",
      enabled: process.env.AUTO_COLLECT_ENABLED !== "false",
      intervalMs: Number.isFinite(configuredIntervalMs) && configuredIntervalMs >= 10_000 ? configuredIntervalMs : defaultIntervalMs,
      isRunning: false
    },
    "github-daily": {
      schedule: "github-daily",
      enabled: process.env.GITHUB_TRENDING_DAILY_ENABLED !== "false",
      intervalMs: dayMs,
      isRunning: false
    },
    "github-weekly": {
      schedule: "github-weekly",
      enabled: process.env.GITHUB_TRENDING_WEEKLY_ENABLED !== "false",
      intervalMs: weekMs,
      isRunning: false
    }
  },
  timers: {}
};

(globalThis as typeof globalThis & { [globalKey]?: SchedulerGlobal })[globalKey] = schedulerGlobal;

type ScheduleKey = keyof SchedulerGlobal["states"];

function isSchedulerGlobal(value: unknown): value is SchedulerGlobal {
  return Boolean(
    value &&
      typeof value === "object" &&
      "states" in value &&
      "timers" in value &&
      (value as SchedulerGlobal).states?.default &&
      (value as SchedulerGlobal).states?.["github-daily"] &&
      (value as SchedulerGlobal).states?.["github-weekly"]
  );
}

function getState(schedule: ScheduleKey = "default") {
  return schedulerGlobal.states[schedule];
}

function setState(schedule: ScheduleKey, next: SchedulerState) {
  schedulerGlobal.states[schedule] = next;
}

export function getSchedulerState() {
  return {
    ...getState("default"),
    hasTimer: Boolean(schedulerGlobal.timers.default),
    schedules: Object.fromEntries(
      (Object.keys(schedulerGlobal.states) as ScheduleKey[]).map((schedule) => [
        schedule,
        { ...schedulerGlobal.states[schedule], hasTimer: Boolean(schedulerGlobal.timers[schedule]) }
      ])
    )
  };
}

export async function runCollection(db: AppDb, trigger: "manual" | "scheduler", schedule: ScheduleKey = "default") {
  const state = getState(schedule);
  if (state.isRunning) {
    log.warn("collection skipped because previous run is still active", { trigger, state });
    return {
      skipped: true,
      reason: "collection_already_running",
      trigger,
      state: getSchedulerState()
    };
  }

  if (trigger === "scheduler" && schedule === "default") {
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

  setState(schedule, {
    ...state,
    isRunning: true,
    lastStartedAt: new Date().toISOString(),
    lastError: undefined
  });
  log.info("collection started", { trigger, schedule, intervalMs: getState(schedule).intervalMs });

  try {
    const config = await loadRadarConfig();
    const result = await collectRadar(db, config, { schedule });
    setState(schedule, {
      ...getState(schedule),
      isRunning: false,
      lastFinishedAt: new Date().toISOString()
    });
    log.info("collection finished", { trigger, result, state });
    return { skipped: false, trigger, result, state: getSchedulerState() };
  } catch (error) {
    setState(schedule, {
      ...getState(schedule),
      isRunning: false,
      lastFinishedAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : String(error)
    });
    log.error("collection failed", { trigger, ...errorMeta(error), state });
    throw error;
  }
}

export function startAutoCollector(db: AppDb) {
  for (const schedule of Object.keys(schedulerGlobal.states) as ScheduleKey[]) {
    const state = getState(schedule);
    if (!state.enabled || schedulerGlobal.timers[schedule]) continue;
    schedulerGlobal.timers[schedule] = setInterval(() => {
      runCollection(db, "scheduler", schedule).catch((error) => {
        log.error("auto collection failed", { schedule, ...errorMeta(error) });
      });
    }, state.intervalMs);
    log.info("auto collection enabled", { schedule, intervalSeconds: Math.round(state.intervalMs / 1000) });
  }
  return getSchedulerState();
}

export function stopAutoCollector() {
  for (const schedule of Object.keys(schedulerGlobal.timers) as ScheduleKey[]) {
    const timer = schedulerGlobal.timers[schedule];
    if (timer) {
      clearInterval(timer);
      schedulerGlobal.timers[schedule] = undefined;
      log.info("auto collection stopped", { schedule });
    }
  }
  return getSchedulerState();
}

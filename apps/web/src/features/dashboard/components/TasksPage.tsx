import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  DeliveryBox01Icon,
  RefreshIcon
} from "@hugeicons/core-free-icons";
import { getCollectRuns, getSchedulerState, type CollectRun, type SchedulerTaskState } from "../../../shared/api/client";

const relativeFormatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

export function TasksPage() {
  const [runs, setRuns] = React.useState<CollectRun[]>([]);
  const [tasks, setTasks] = React.useState<SchedulerTaskState[]>([]);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const load = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setIsLoading(true);
    else setIsRefreshing(true);
    setError("");
    try {
      const [nextRuns, scheduler] = await Promise.all([getCollectRuns(), getSchedulerState()]);
      setRuns(nextRuns);
      setTasks(Object.values(scheduler.schedules ?? { default: scheduler }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法获取任务信息");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load("initial");
    const timer = window.setInterval(() => void load("refresh"), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const runningTasks = tasks.filter((task) => task.isRunning);
  const latestRun = runs[0] ?? null;

  if (isLoading) return <TasksSkeleton />;

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-radar-ink-muted">
            <HugeiconsIcon icon={DeliveryBox01Icon} className="h-4 w-4 text-primary" />
            Tasks
          </div>
          <h1 className="mt-1.5 text-[1.7rem] font-semibold leading-tight text-radar-ink sm:text-3xl">任务</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-radar-ink-soft">
            查看自动抓取任务是否启用、当前是否运行，以及最近的历史运行结果。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MetricPill label="任务" value={tasks.length} />
          <MetricPill label="运行中" value={runningTasks.length} />
          <MetricPill label="历史" value={runs.length} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-3.5 text-sm font-medium text-radar-ink-soft shadow-card transition-[background-color,color,transform] duration-200 ease-out hover:-translate-y-px hover:bg-radar-surface-soft hover:text-radar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={isRefreshing}
            onClick={() => void load("refresh")}
            type="button"
          >
            <HugeiconsIcon icon={RefreshIcon} className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {error ? <div className="rounded-card border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <section className="grid gap-3 lg:grid-cols-3">
        {tasks.map((task) => (
          <TaskCard key={task.schedule} task={task} />
        ))}
      </section>

      <section className="rounded-card border border-radar-line bg-radar-surface/90 p-4 shadow-card">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 text-radar-ink-muted">
              <HugeiconsIcon icon={DeliveryBox01Icon} className="h-4 w-4 text-primary" />
              History
            </div>
            <h2 className="mt-1 text-[15px] font-semibold leading-6 text-radar-ink">历史运行记录</h2>
          </div>
          <p className="text-xs leading-5 text-radar-ink-muted">
            {latestRun ? `最近一次 ${formatRelativeTime(latestRun.startedAt)}` : "暂无运行记录"}
          </p>
        </div>
        <RunTable runs={runs} />
      </section>
    </section>
  );
}

function TaskCard({ task }: { task: SchedulerTaskState }) {
  return (
    <article className="rounded-card border border-radar-line bg-radar-surface/90 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-radar-ink">{taskName(task.schedule)}</h2>
          <p className="mt-1 text-xs text-radar-ink-muted">{formatInterval(task.intervalMs)}</p>
        </div>
        <StatusBadge status={task.isRunning ? "running" : task.enabled && task.hasTimer ? "success" : "paused"} />
      </div>
      <dl className="mt-4 grid gap-2 text-xs">
        <TaskMeta label="启用" value={task.enabled ? "是" : "否"} />
        <TaskMeta label="定时器" value={task.hasTimer ? "已启动" : "未启动"} />
        <TaskMeta label="最近开始" value={task.lastStartedAt ? formatRelativeTime(task.lastStartedAt) : "暂无"} />
        <TaskMeta label="最近结束" value={task.lastFinishedAt ? formatRelativeTime(task.lastFinishedAt) : "暂无"} />
      </dl>
      {task.lastError ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-destructive">{task.lastError}</p> : null}
    </article>
  );
}

function TaskMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-radar-ink-muted">{label}</dt>
      <dd className="truncate font-medium text-radar-ink">{value}</dd>
    </div>
  );
}

function RunTable({ runs }: { runs: CollectRun[] }) {
  if (!runs.length) return <EmptyRuns />;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-radar-line">
      <div className="overflow-x-auto">
        <table className="min-w-[52rem] w-full border-collapse text-left text-sm">
          <thead className="bg-radar-surface-soft text-xs font-semibold text-radar-ink-muted">
            <tr>
              <th className="px-3 py-2.5">状态</th>
              <th className="px-3 py-2.5">开始时间</th>
              <th className="px-3 py-2.5">耗时</th>
              <th className="px-3 py-2.5 text-right">采集</th>
              <th className="px-3 py-2.5 text-right">新增</th>
              <th className="px-3 py-2.5 text-right">更新</th>
              <th className="px-3 py-2.5">记录</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-radar-line">
            {runs.map((run) => (
              <tr className="transition-colors duration-150 ease-out hover:bg-radar-surface-soft/70" key={run.id}>
                <td className="px-3 py-3"><StatusBadge status={run.status} /></td>
                <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums text-radar-ink">{formatDateTime(run.startedAt)}</td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-radar-ink-soft">{formatDuration(run.startedAt, run.finishedAt)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-radar-ink">{formatCompactNumber(run.collectedCount)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-radar-ink-soft">{formatCompactNumber(run.insertedCount)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-radar-ink-soft">{formatCompactNumber(run.updatedCount)}</td>
                <td className="max-w-[18rem] px-3 py-3">
                  {run.error ? (
                    <span className="block truncate text-destructive" title={run.error}>{run.error}</span>
                  ) : (
                    <span className="block truncate font-mono text-xs text-radar-ink-muted" title={run.id}>{run.id}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const icon = status === "failed" ? Cancel01Icon : CheckmarkCircle02Icon;
  const className =
    status === "success"
      ? "bg-primary text-primary-foreground"
      : status === "failed"
        ? "bg-destructive text-destructive-foreground"
        : status === "running"
          ? "bg-radar-blue text-radar-blue-ink"
          : "bg-radar-surface-soft text-radar-ink-muted";

  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${className}`}>
      <HugeiconsIcon icon={status === "running" ? RefreshIcon : icon} className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {statusLabel(status)}
    </span>
  );
}

function MetricPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-3 text-sm shadow-card">
      <span className="text-radar-ink-muted">{label}</span>
      <span className="font-semibold tabular-nums text-radar-ink">{value}</span>
    </div>
  );
}

function EmptyRuns() {
  return (
    <div className="mt-4 flex min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-radar-line px-4 text-center">
      <div>
        <HugeiconsIcon icon={DeliveryBox01Icon} className="mx-auto h-8 w-8 text-radar-ink-muted" />
        <p className="mt-3 text-sm font-medium text-radar-ink">暂无历史记录</p>
        <p className="mt-1 text-xs text-radar-ink-muted">触发采集或等待自动任务运行后，这里会显示记录。</p>
      </div>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <section className="flex w-full flex-col gap-5">
      <div className="h-24 animate-pulse rounded-card bg-radar-surface/70" />
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div className="h-36 animate-pulse rounded-card bg-radar-surface/70" key={index} />)}
      </div>
      <div className="h-[28rem] animate-pulse rounded-card bg-radar-surface/70" />
    </section>
  );
}

function taskName(schedule: string) {
  if (schedule === "github-daily") return "GitHub 每日热榜";
  if (schedule === "github-weekly") return "GitHub 每周热榜";
  return "Hacker News 默认采集";
}

function statusLabel(status: string) {
  if (status === "success") return "正常";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  if (status === "paused") return "未运行";
  return status;
}

function formatInterval(ms: number) {
  if (ms >= 7 * 24 * 60 * 60 * 1000) return "每 7 天自动运行";
  if (ms >= 24 * 60 * 60 * 1000) return "每 24 小时自动运行";
  if (ms >= 60 * 60 * 1000) return `每 ${Math.round(ms / 60 / 60 / 1000)} 小时自动运行`;
  return `每 ${Math.round(ms / 60 / 1000)} 分钟自动运行`;
}

function formatDuration(startedAt: string, finishedAt: string | null) {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "暂无";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const deltaSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(deltaSeconds);
  if (absSeconds < 60) return "刚刚";
  if (absSeconds < 3600) return relativeFormatter.format(Math.round(deltaSeconds / 60), "minute");
  if (absSeconds < 86_400) return relativeFormatter.format(Math.round(deltaSeconds / 3600), "hour");
  return relativeFormatter.format(Math.round(deltaSeconds / 86_400), "day");
}

function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

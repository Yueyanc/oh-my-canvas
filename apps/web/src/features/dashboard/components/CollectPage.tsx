import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  DeliveryBox01Icon,
  RefreshIcon
} from "@hugeicons/core-free-icons";
import { getCollectRuns, triggerCollection, type CollectRun } from "../../../shared/api/client";

const relativeFormatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

export function CollectPage() {
  const [runs, setRuns] = React.useState<CollectRun[]>([]);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isCollecting, setIsCollecting] = React.useState(false);

  const loadRuns = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setIsLoading(true);
    else setIsRefreshing(true);
    setError("");
    try {
      setRuns(await getCollectRuns());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法获取采集记录");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRuns("initial");
  }, [loadRuns]);

  async function collectNow() {
    setIsCollecting(true);
    setError("");
    try {
      await triggerCollection();
      await loadRuns("refresh");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "触发采集失败");
    } finally {
      setIsCollecting(false);
    }
  }

  const latestRun = runs[0] ?? null;
  const successCount = runs.filter((run) => run.status === "success").length;
  const runningCount = runs.filter((run) => run.status === "running").length;

  if (isLoading) return <CollectSkeleton />;

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-radar-ink-muted">
            <HugeiconsIcon icon={DeliveryBox01Icon} className="h-4 w-4 text-primary" />
            采集
          </div>
          <h1 className="mt-1.5 text-[1.7rem] font-semibold leading-tight text-radar-ink sm:text-3xl">
            抓取记录
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-radar-ink-soft">
            查看最近采集任务的运行状态、采集数量、新增与更新结果。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MetricPill label="记录" value={runs.length} />
          <MetricPill label="成功" value={successCount} />
          <MetricPill label="运行中" value={runningCount} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-3.5 text-sm font-medium text-radar-ink-soft shadow-card transition-[background-color,color,transform] duration-200 ease-out hover:-translate-y-px hover:bg-radar-surface-soft hover:text-radar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={isRefreshing || isCollecting}
            onClick={() => void loadRuns("refresh")}
            type="button"
          >
            <HugeiconsIcon icon={RefreshIcon} className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            刷新
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-[background-color,transform] duration-200 ease-out hover:-translate-y-px hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={isCollecting}
            onClick={() => void collectNow()}
            type="button"
          >
            <HugeiconsIcon icon={DeliveryBox01Icon} className="h-4 w-4" />
            {isCollecting ? "采集中" : "立即采集"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-card border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-card border border-radar-line bg-radar-surface/90 p-4 shadow-card">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 text-radar-ink-muted">
              <HugeiconsIcon icon={DeliveryBox01Icon} className="h-4 w-4 text-primary" />
              Runs
            </div>
            <h2 className="mt-1 text-[15px] font-semibold leading-6 text-radar-ink">最近采集记录</h2>
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
                <td className="px-3 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums text-radar-ink">
                  {formatDateTime(run.startedAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-radar-ink-soft">
                  {formatDuration(run.startedAt, run.finishedAt)}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-radar-ink">
                  {formatCompactNumber(run.collectedCount)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-radar-ink-soft">
                  {formatCompactNumber(run.insertedCount)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-radar-ink-soft">
                  {formatCompactNumber(run.updatedCount)}
                </td>
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
        : "bg-radar-blue text-radar-blue-ink";

  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${className}`}>
      <HugeiconsIcon icon={status === "running" ? RefreshIcon : icon} className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {runStatusLabel(status)}
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
        <p className="mt-3 text-sm font-medium text-radar-ink">暂无采集记录</p>
        <p className="mt-1 text-xs text-radar-ink-muted">点击立即采集后，这里会显示抓取任务记录。</p>
      </div>
    </div>
  );
}

function CollectSkeleton() {
  return (
    <section className="flex w-full flex-col gap-5">
      <div className="h-24 animate-pulse rounded-card bg-radar-surface/70" />
      <div className="h-[28rem] animate-pulse rounded-card bg-radar-surface/70" />
    </section>
  );
}

function runStatusLabel(status: string) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  return status;
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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 1
  }).format(value);
}

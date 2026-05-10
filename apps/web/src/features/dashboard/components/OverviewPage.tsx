import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  ChartLineData01Icon,
  DashboardSquare01Icon,
  FireIcon,
  RankingIcon,
  RefreshIcon
} from "@hugeicons/core-free-icons";
import type { IconType } from "react-icons";
import {
  SiBaidu,
  SiBilibili,
  SiBytedance,
  SiGithub,
  SiRss,
  SiTiktok,
  SiVercel,
  SiYcombinator,
  SiZhihu
} from "react-icons/si";
import { getRadarOverview, type OverviewItem, type OverviewSource, type RadarOverview } from "../../../shared/api/client";

const relativeFormatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
const metricLabels: Record<string, string> = {
  rank: "原榜",
  hot: "热度",
  stars: "Stars",
  forks: "Forks",
  points: "点赞",
  comments: "评论",
  likes: "点赞",
  views: "浏览"
};

export function OverviewPage() {
  const [overview, setOverview] = React.useState<RadarOverview | null>(null);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadOverview = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setIsLoading(true);
    else setIsRefreshing(true);
    setError("");
    try {
      setOverview(await getRadarOverview());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法获取总览数据");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOverview("initial");
    const timer = window.setInterval(() => void loadOverview("refresh"), 60_000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  if (isLoading) return <OverviewSkeleton />;

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-radar-ink-muted">
            <HugeiconsIcon icon={DashboardSquare01Icon} className="h-4 w-4 text-primary" />
            总览
          </div>
          <h1 className="mt-1.5 text-[1.7rem] font-semibold leading-tight text-radar-ink sm:text-3xl">
            实时热榜排名
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-radar-ink-soft">
            优先展示各来源原始排行与原始指标；来源内展示连续排名，原始 rank 只参与排序。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MetricPill label="来源" value={overview?.totals.activeSourceCount ?? 0} />
          <MetricPill label="条目池" value={overview?.totals.itemCount ?? 0} />
          <MetricPill label="更新" value={overview?.generatedAt ? formatRelativeTime(overview.generatedAt) : "暂无"} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-3.5 text-sm font-medium text-radar-ink-soft shadow-card transition-[background-color,color,transform] duration-200 ease-out hover:-translate-y-px hover:bg-radar-surface-soft hover:text-radar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={isRefreshing}
            onClick={() => void loadOverview("refresh")}
            type="button"
          >
            <HugeiconsIcon icon={RefreshIcon} className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "刷新中" : "刷新"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-card border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {overview ? (
        <>
          <SourceGrid sources={overview.sources} />
          <GlobalRanking items={overview.globalItems} latestRun={overview.latestRun} />
        </>
      ) : (
        <EmptyOverview />
      )}
    </section>
  );
}

function SourceGrid({ sources }: { sources: OverviewSource[] }) {
  const activeSources = sources.filter((source) => source.enabled || source.items.length > 0);
  if (!activeSources.length) return <EmptyOverview />;

  return (
    <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {activeSources.map((source) => (
        <SourceRankingCard key={source.id} source={source} />
      ))}
    </section>
  );
}

function SourceRankingCard({ source }: { source: OverviewSource }) {
  return (
    <article className="flex min-h-[18rem] transform-gpu flex-col rounded-card border border-radar-line bg-radar-surface/90 p-4 shadow-card transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-radar-line-strong hover:bg-radar-surface motion-reduce:transform-none motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <SourceTitle source={source} />
        <MetricBadge label="条目" value={source.itemCount} />
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1">
        {source.items.length ? source.items.map((item, index) => <SourceRankRow item={item} key={item.id} fallbackRank={index + 1} />) : <EmptyList />}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-radar-line pt-3 text-xs text-radar-ink-muted">
        <span>权重 <strong className="font-semibold tabular-nums text-radar-ink-soft">{formatCompactNumber(source.weight)}</strong></span>
        <span>{source.lastSeenAt ? `最近 ${formatRelativeTime(source.lastSeenAt)}` : "暂无更新"}</span>
      </div>
    </article>
  );
}

function SourceTitle({ source }: { source: OverviewSource }) {
  const platform = platformIconFor(source);
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 text-radar-ink-muted">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-radar-surface-soft text-primary" title={platform.label}>
          {platform.Icon ? <platform.Icon className="h-3.5 w-3.5" /> : <HugeiconsIcon icon={RankingIcon} className="h-4 w-4" />}
        </span>
        <span className="truncate">{platform.label}</span>
      </div>
      <h2 className="mt-1 truncate text-[15px] font-semibold leading-6 text-radar-ink">{source.name}</h2>
    </div>
  );
}

function GlobalRanking({
  items,
  latestRun
}: {
  items: OverviewItem[];
  latestRun: RadarOverview["latestRun"];
}) {
  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="rounded-card border border-radar-line bg-radar-surface/90 p-4 shadow-card">
        <SectionTitle icon={FireIcon} kicker="全站" title="综合热度 Top 20" />
        <div className="mt-3 grid gap-1">
          {items.length ? items.map((item, index) => <GlobalRankRow item={item} key={item.id} rank={index + 1} />) : <EmptyList />}
        </div>
      </div>

      <aside className="rounded-card border border-radar-line bg-radar-surface/90 p-4 shadow-card">
        <SectionTitle icon={ChartLineData01Icon} kicker="采集状态" title="最近一次运行" />
        <dl className="mt-4 grid gap-2.5 text-sm">
          <StatusLine label="状态" value={latestRun ? runStatusLabel(latestRun.status) : "暂无"} tone={latestRun?.status} />
          <StatusLine label="开始" value={latestRun ? formatDateTime(latestRun.startedAt) : "暂无"} />
          <StatusLine label="完成" value={latestRun?.finishedAt ? formatDateTime(latestRun.finishedAt) : "暂无"} />
          <StatusLine label="采集" value={latestRun ? `${latestRun.collectedCount} 条` : "0 条"} />
          <StatusLine label="新增/更新" value={latestRun ? `${latestRun.insertedCount}/${latestRun.updatedCount}` : "0/0"} />
        </dl>
        {latestRun?.error ? (
          <p className="mt-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
            {latestRun.error}
          </p>
        ) : null}
      </aside>
    </section>
  );
}

function GlobalRankRow({ item, rank }: { item: OverviewItem; rank: number }) {
  return (
    <a className="group grid min-h-10 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition-colors duration-150 ease-out hover:border-radar-line hover:bg-radar-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" href={item.url} rel="noreferrer" target="_blank">
      <RankMarker rank={rank} />
      <ItemText item={item} showSource />
      <ItemScore item={item} />
    </a>
  );
}

function SourceRankRow({ item, fallbackRank }: { item: OverviewItem; fallbackRank: number }) {
  return (
    <a className="group grid min-h-10 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-colors duration-150 ease-out hover:border-radar-line hover:bg-radar-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" href={item.url} rel="noreferrer" target="_blank">
      <RankMarker rank={item.displayRank ?? fallbackRank} isFallback={item.rank === null} />
      <ItemText item={item} />
      <ItemScore item={item} />
    </a>
  );
}

function ItemText({ item, showSource = false }: { item: OverviewItem; showSource?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <h3 className="truncate text-[13.5px] font-medium leading-5 text-radar-ink group-hover:text-primary">
          {item.displayTitle ?? item.title}
        </h3>
        <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5 shrink-0 text-radar-ink-muted opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 motion-reduce:transition-none" />
      </div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-[11px] leading-4 text-radar-ink-muted">
        {showSource ? <span className="shrink-0 font-medium text-radar-ink-soft">{item.sourceName}</span> : null}
        {item.category ? <span className="shrink-0">{item.category}</span> : null}
        <RawMetricChips item={item} />
      </div>
    </div>
  );
}

function RawMetricChips({ item }: { item: OverviewItem }) {
  const metrics = rawMetricEntries(item);
  if (!metrics.length) return <span className="truncate">{item.summary ?? item.author ?? item.url}</span>;

  return (
    <>
      {metrics.map(([key, value]) => (
        <span className="rounded-full bg-radar-surface-soft px-1.5 text-radar-ink-soft" key={key}>
          {metricLabels[key] ?? key} {formatMetricValue(key, value)}
        </span>
      ))}
    </>
  );
}

function ItemScore({ item }: { item: OverviewItem }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-end">
      <span className="text-[13px] font-semibold tabular-nums leading-5 text-radar-ink">{formatCompactNumber(item.score)}</span>
      <span className="text-[11px] tabular-nums leading-4 text-radar-ink-muted">综合分</span>
    </div>
  );
}

function RankMarker({ rank, isFallback = false }: { rank: number; isFallback?: boolean }) {
  const isTop = rank <= 3;
  return (
    <div
      className={
        isTop
          ? "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground shadow-sm"
          : "flex h-7 w-7 items-center justify-center rounded-full bg-radar-surface-soft text-xs font-semibold tabular-nums text-radar-ink-soft"
      }
      title={isFallback ? "按热度补位排序" : "来源展示排名"}
    >
      {rank}
    </div>
  );
}

function SectionTitle({
  icon,
  kicker,
  title
}: {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  kicker: string;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase leading-4 text-radar-ink-muted">
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-primary" />
        <span className="truncate">{kicker}</span>
      </div>
      <h2 className="mt-1 truncate text-[15px] font-semibold leading-6 text-radar-ink">{title}</h2>
    </div>
  );
}

function platformIconFor(source: OverviewSource): { Icon?: IconType; label: string } {
  const key = `${source.id} ${source.name} ${source.type}`.toLowerCase();
  if (key.includes("baidu") || key.includes("百度")) return { Icon: SiBaidu, label: "BAIDU" };
  if (key.includes("zhihu") || key.includes("知乎")) return { Icon: SiZhihu, label: "ZHIHU" };
  if (key.includes("hackernews") || key.includes("hacker news") || key.includes("hn-")) {
    return { Icon: SiYcombinator, label: "HACKER NEWS" };
  }
  if (key.includes("github")) return { Icon: SiGithub, label: "GITHUB" };
  if (key.includes("vercel")) return { Icon: SiVercel, label: "VERCEL" };
  if (key.includes("bilibili")) return { Icon: SiBilibili, label: "BILIBILI" };
  if (key.includes("douyin") || key.includes("抖音")) return { Icon: SiTiktok, label: "DOUYIN" };
  if (key.includes("toutiao") || key.includes("头条")) return { Icon: SiBytedance, label: "TOUTIAO" };
  if (source.type === "rss") return { Icon: SiRss, label: "RSS" };
  if (source.type === "newsnow") return { label: "NEWSNOW" };
  return { label: source.type.toUpperCase() };
}

function MetricPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-3 text-sm shadow-card">
      <span className="text-radar-ink-muted">{label}</span>
      <span className="font-semibold tabular-nums text-radar-ink">{value}</span>
    </div>
  );
}

function MetricBadge({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-radar-surface-soft px-2.5 text-xs text-radar-ink-soft">
      {label}
      <strong className="font-semibold tabular-nums text-radar-ink">{value}</strong>
    </span>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const toneClass =
    tone === "success"
      ? "text-primary"
      : tone === "failed"
        ? "text-destructive"
        : tone === "running"
          ? "text-radar-blue-ink"
          : "text-radar-ink";

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-radar-ink-muted">{label}</dt>
      <dd className={`text-right font-medium tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}

function EmptyOverview() {
  return (
    <div className="flex min-h-[24rem] items-center justify-center rounded-card border border-dashed border-radar-line bg-radar-surface/70 px-4 text-center">
      <div>
        <HugeiconsIcon icon={DashboardSquare01Icon} className="mx-auto h-8 w-8 text-radar-ink-muted" />
        <p className="mt-3 text-sm font-medium text-radar-ink">暂无热榜数据</p>
        <p className="mt-1 text-xs text-radar-ink-muted">等待采集器完成一次运行后，这里会显示各来源排名。</p>
      </div>
    </div>
  );
}

function EmptyList() {
  return <div className="rounded-xl border border-dashed border-radar-line px-3 py-6 text-center text-sm text-radar-ink-muted">暂无条目</div>;
}

function OverviewSkeleton() {
  return (
    <section className="flex w-full flex-col gap-5">
      <div className="h-24 animate-pulse rounded-card bg-radar-surface/70" />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="h-[18rem] animate-pulse rounded-card bg-radar-surface/70" key={index} />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="h-[24rem] animate-pulse rounded-card bg-radar-surface/70" />
        <div className="h-[24rem] animate-pulse rounded-card bg-radar-surface/70" />
      </div>
    </section>
  );
}

function rawMetricEntries(item: OverviewItem) {
  return Object.entries(item.metrics ?? {}).slice(0, 3);
}

function runStatusLabel(status: string) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  return status;
}

function formatMetricValue(key: string, value: number | string) {
  if (key === "rank") return `#${value}`;
  return typeof value === "number" ? formatCompactNumber(value) : value;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 1
  }).format(value);
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

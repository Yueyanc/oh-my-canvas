import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, FireIcon, PackageIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Button } from "../../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import {
  getGithubTrendingReaderItems,
  triggerGithubTrendingCollection,
  type GithubTrendingReaderItem
} from "../../../shared/api/client";

const relativeFormatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
type PeriodFilter = "all" | "daily" | "weekly";
type SortMode = "quality" | "rank";

export function GithubTrendingReaderPage() {
  const [items, setItems] = React.useState<GithubTrendingReaderItem[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<PeriodFilter>("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("quality");
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [collecting, setCollecting] = React.useState<"daily" | "weekly" | null>(null);

  const loadItems = React.useCallback(async (mode: "initial" | "refresh" = "refresh", nextPeriod = period) => {
    if (mode === "initial") setIsLoading(true);
    setError("");
    try {
      const nextItems = await getGithubTrendingReaderItems(nextPeriod);
      setItems(nextItems);
      setActiveId((current) => current ?? nextItems[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法获取 GitHub 热榜数据");
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  React.useEffect(() => {
    void loadItems("initial");
  }, [loadItems]);

  async function collectNow(nextPeriod: "daily" | "weekly") {
    setCollecting(nextPeriod);
    setError("");
    try {
      await triggerGithubTrendingCollection(nextPeriod);
      const nextFilter = period === "all" ? period : nextPeriod;
      if (period !== "all" && period !== nextPeriod) setPeriod(nextPeriod);
      await loadItems("refresh", nextFilter);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "触发 GitHub 热榜采集失败");
    } finally {
      setCollecting(null);
    }
  }

  const visibleItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortMode === "rank") {
        const rankDelta = (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
        if (rankDelta !== 0) return rankDelta;
        return b.score - a.score;
      }
      if (b.score !== a.score) return b.score - a.score;
      return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
    });
  }, [items, sortMode]);

  React.useEffect(() => {
    if (!visibleItems.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !visibleItems.some((item) => item.id === activeId)) {
      setActiveId(visibleItems[0]?.id ?? null);
    }
  }, [activeId, visibleItems]);

  const activeItem = visibleItems.find((item) => item.id === activeId) ?? visibleItems[0] ?? null;

  if (isLoading) return <GithubReaderSkeleton />;

  return (
    <section className="flex min-h-0 w-full flex-col gap-3">
      {error ? <div className="rounded-card border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      {items.length ? (
        <div className="grid min-h-[calc(100dvh-6rem)] gap-3 xl:grid-cols-[23rem_minmax(0,1fr)]">
          <aside className="min-h-0 rounded-card border border-radar-line bg-radar-surface/90 shadow-card">
            <div className="border-b border-radar-line px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-radar-ink">热门仓库</h2>
                <span className="rounded-full bg-radar-surface-soft px-2 py-1 text-xs text-radar-ink-muted">{visibleItems.length} 个</span>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <FilterSelect
                    label="排序"
                    onChange={(value) => setSortMode(value as SortMode)}
                    options={[
                      { label: "按质量分", value: "quality" },
                      { label: "按原始排名", value: "rank" }
                    ]}
                    value={sortMode}
                  />
                  <FilterSelect
                    label="榜单"
                    onChange={(value) => {
                      const nextPeriod = value as PeriodFilter;
                      setPeriod(nextPeriod);
                      void loadItems("refresh", nextPeriod);
                    }}
                    options={[
                      { label: "全部", value: "all" },
                      { label: "每日榜", value: "daily" },
                      { label: "每周榜", value: "weekly" }
                    ]}
                    value={period}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-9 rounded-xl text-xs" disabled={collecting !== null} onClick={() => void collectNow("daily")} variant="outline">
                    <HugeiconsIcon icon={RefreshIcon} className="h-3.5 w-3.5" />
                    {collecting === "daily" ? "采集中" : "抓每日"}
                  </Button>
                  <Button className="h-9 rounded-xl text-xs" disabled={collecting !== null} onClick={() => void collectNow("weekly")} variant="outline">
                    <HugeiconsIcon icon={RefreshIcon} className="h-3.5 w-3.5" />
                    {collecting === "weekly" ? "采集中" : "抓每周"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto p-2">
              {visibleItems.map((item) => (
                <GithubListItem active={item.id === activeItem?.id} item={item} key={item.id} onSelect={() => setActiveId(item.id)} />
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-hidden rounded-card border border-radar-line bg-radar-surface/90 shadow-card">
            {activeItem ? <GithubDetail item={activeItem} /> : <EmptyGithubReader />}
          </main>
        </div>
      ) : (
        <EmptyGithubReader onCollectDaily={() => void collectNow("daily")} onCollectWeekly={() => void collectNow("weekly")} />
      )}
    </section>
  );
}

function FilterSelect({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[11px] font-medium text-radar-ink-muted">{label}</label>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className="h-9 rounded-xl border-radar-line bg-radar-surface-soft px-2.5 text-xs text-radar-ink shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function GithubListItem({ item, active, onSelect }: { item: GithubTrendingReaderItem; active: boolean; onSelect: () => void }) {
  const title = item.brief?.chineseName || item.displayTitle || item.title;
  return (
    <button
      className={
        active
          ? "mb-1 w-full rounded-xl border border-primary/35 bg-primary/10 px-3 py-2.5 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "mb-1 w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors duration-150 ease-out hover:border-radar-line hover:bg-radar-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      }
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 text-[13px] font-medium leading-5 text-radar-ink">{title}</h3>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">{formatCompactNumber(item.score)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-4 text-radar-ink-muted">
        {item.rank ? <span className="rounded-full bg-radar-surface-soft px-1.5">#{item.rank}</span> : null}
        <span className="rounded-full bg-radar-surface-soft px-1.5">{periodLabel(item.period)}</span>
        {item.language ? <span className="rounded-full bg-radar-surface-soft px-1.5">{item.language}</span> : null}
        <span className="rounded-full bg-radar-surface-soft px-1.5">+{formatCompactNumber(item.currentPeriodStars)} stars</span>
      </div>
      <p className="mt-1 text-[11px] text-radar-ink-muted">{formatRelativeTime(item.lastSeenAt)}</p>
    </button>
  );
}

function GithubDetail({ item }: { item: GithubTrendingReaderItem }) {
  const title = item.brief?.chineseName || item.displayTitle || item.title;
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [item.id]);

  return (
    <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto" ref={scrollRef}>
      <header className="border-b border-radar-line px-5 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-radar-ink-muted">
              <span>质量分 {formatCompactNumber(item.score)}</span>
              <span>{periodLabel(item.period)}</span>
              {item.rank ? <span>榜单 #{item.rank}</span> : null}
              {item.author ? <span>@{item.author}</span> : null}
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-radar-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-radar-ink-muted">{item.repository}</p>
          </div>
          <a
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-radar-line bg-radar-surface px-3 text-xs font-medium text-radar-ink-soft transition-colors hover:bg-radar-surface-soft hover:text-radar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5 px-5 py-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="总 Stars" value={formatCompactNumber(item.stars)} />
          <Metric label="周期新增" value={`+${formatCompactNumber(item.currentPeriodStars)}`} />
          <Metric label="Forks" value={formatCompactNumber(item.forks)} />
          <Metric label="语言" value={item.language ?? "未知"} />
        </section>

        {item.brief ? (
          <>
            <section>
              <SectionHeading title="AI 项目解读" />
              <p className="mt-3 text-[15px] leading-7 text-radar-ink">{item.brief.overview}</p>
              {item.brief.projectStage ? <p className="mt-3 border-l-2 border-primary pl-3 text-sm leading-6 text-radar-ink">{item.brief.projectStage}</p> : null}
            </section>
            <TextList title="亮点" values={item.brief.highlights} />
            <TextList title="适合场景" values={item.brief.useCases} />
            <TextList title="风险与限制" values={item.brief.concerns} />
            {item.brief.sourceLimitations ? <p className="border-l-2 border-radar-line pl-3 text-xs leading-5 text-radar-ink-muted">{item.brief.sourceLimitations}</p> : null}
          </>
        ) : (
          <section className="rounded-xl border border-dashed border-radar-line px-4 py-5">
            <p className="text-sm font-medium text-radar-ink">这条仓库还没有 AI 项目解读。</p>
            <p className="mt-2 text-sm leading-6 text-radar-ink-muted">下一次 GitHub 热榜采集会读取 README 并生成中文说明。</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-radar-line px-3 py-2">
      <p className="text-[11px] text-radar-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-radar-ink">{value}</p>
    </div>
  );
}

function TextList({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-radar-ink">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-radar-ink">
        {values.map((value) => (
          <li className="pl-1 marker:text-primary" key={value}>{value}</li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <HugeiconsIcon icon={FireIcon} className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-radar-ink">{title}</h3>
    </div>
  );
}

function EmptyGithubReader({ onCollectDaily, onCollectWeekly }: { onCollectDaily?: () => void; onCollectWeekly?: () => void }) {
  return (
    <div className="flex min-h-[24rem] items-center justify-center rounded-card border border-dashed border-radar-line bg-radar-surface/70 px-4 text-center">
      <div>
        <HugeiconsIcon icon={PackageIcon} className="mx-auto h-8 w-8 text-radar-ink-muted" />
        <p className="mt-3 text-sm font-medium text-radar-ink">暂无 GitHub 热榜数据</p>
        <p className="mt-1 text-xs text-radar-ink-muted">先手动抓取一次每日榜或每周榜。</p>
        {onCollectDaily && onCollectWeekly ? (
          <div className="mt-4 flex justify-center gap-2">
            <Button className="h-9 rounded-xl text-xs" onClick={onCollectDaily} variant="outline">抓每日</Button>
            <Button className="h-9 rounded-xl text-xs" onClick={onCollectWeekly} variant="outline">抓每周</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GithubReaderSkeleton() {
  return (
    <section className="grid min-h-[calc(100dvh-6rem)] w-full gap-3 xl:grid-cols-[23rem_minmax(0,1fr)]">
      <div className="rounded-card border border-radar-line bg-radar-surface/70 p-4">
        <div className="h-5 w-24 rounded-full bg-radar-surface-soft" />
        <div className="mt-5 grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="h-20 rounded-xl bg-radar-surface-soft/70" key={index} />
          ))}
        </div>
      </div>
      <div className="rounded-card border border-radar-line bg-radar-surface/70 p-6">
        <div className="h-7 w-1/2 rounded-full bg-radar-surface-soft" />
        <div className="mt-8 grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-5 rounded-full bg-radar-surface-soft/70" key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function periodLabel(period: string) {
  if (period === "weekly") return "每周榜";
  if (period === "daily") return "每日榜";
  return period;
}

function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  const diffSeconds = Math.round((time - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return "刚刚";
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), "hour");
  return relativeFormatter.format(Math.round(diffSeconds / 86400), "day");
}

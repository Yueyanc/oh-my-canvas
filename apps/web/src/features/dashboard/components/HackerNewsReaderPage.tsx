import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, BookTypeIcon, Calendar03Icon, FireIcon, Message02Icon } from "@hugeicons/core-free-icons";
import type { DateRange } from "react-day-picker";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../../../components/ui/button";
import { Calendar } from "../../../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { getHackerNewsReaderItems, type HackerNewsReaderItem } from "../../../shared/api/client";

const relativeFormatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
type SortMode = "quality" | "hn";
type FeedFilter = "all" | "topstories" | "beststories";
type TimeRange = { from?: Date; to?: Date };

export function HackerNewsReaderPage() {
  const [items, setItems] = React.useState<HackerNewsReaderItem[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [sortMode, setSortMode] = React.useState<SortMode>("quality");
  const [feedFilter, setFeedFilter] = React.useState<FeedFilter>("all");
  const [timeRange, setTimeRange] = React.useState<TimeRange>({});

  const loadItems = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setIsLoading(true);
    setError("");
    try {
      const nextItems = await getHackerNewsReaderItems();
      setItems(nextItems);
      setActiveId((current) => current ?? nextItems[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法获取 Hacker News 阅读数据");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadItems("initial");
  }, [loadItems]);

  const visibleItems = React.useMemo(() => {
    const filtered = items.filter((item) => {
      if (feedFilter !== "all" && !item.feeds.includes(feedFilter)) return false;
      return isInTimeRange(item, timeRange);
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === "hn") {
        const rankDelta = (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
        if (rankDelta !== 0) return rankDelta;
        return b.score - a.score;
      }
      if (b.score !== a.score) return b.score - a.score;
      return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
    });
  }, [feedFilter, items, sortMode, timeRange]);

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

  if (isLoading) return <ReaderSkeleton />;

  return (
    <section className="flex min-h-0 w-full flex-col gap-3">
      {error ? <div className="rounded-card border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      {items.length ? (
        <div className="grid min-h-[calc(100dvh-6rem)] gap-3 xl:grid-cols-[23rem_minmax(0,1fr)]">
          <aside className="min-h-0 rounded-card border border-radar-line bg-radar-surface/90 shadow-card">
            <div className="border-b border-radar-line px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-radar-ink">信息列表</h2>
                <span className="rounded-full bg-radar-surface-soft px-2 py-1 text-xs text-radar-ink-muted">{visibleItems.length} 条</span>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <FilterSelect
                    label="排序"
                    onChange={(value) => setSortMode(value as SortMode)}
                    options={[
                      { label: "按质量分", value: "quality" },
                      { label: "按 HN 排名", value: "hn" }
                    ]}
                    value={sortMode}
                  />
                  <FilterSelect
                    label="来源"
                    onChange={(value) => setFeedFilter(value as FeedFilter)}
                    options={[
                      { label: "全部", value: "all" },
                      { label: "Top", value: "topstories" },
                      { label: "Best", value: "beststories" }
                    ]}
                    value={feedFilter}
                  />
                </div>
                <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
              </div>
            </div>
            <div className="max-h-[calc(100dvh-18.5rem)] overflow-y-auto p-2">
              {visibleItems.map((item) => (
                <ReaderListItem active={item.id === activeItem?.id} item={item} key={item.id} onSelect={() => setActiveId(item.id)} />
              ))}
              {visibleItems.length ? null : <div className="px-3 py-8 text-center text-sm text-radar-ink-muted">当前筛选下暂无条目</div>}
            </div>
          </aside>

          <main className="min-h-0 overflow-hidden rounded-card border border-radar-line bg-radar-surface/90 shadow-card">
            {activeItem ? <ReaderDetail item={activeItem} key={activeItem.id} /> : null}
          </main>
        </div>
      ) : (
        <EmptyReader />
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

function TimeRangeFilter({ value, onChange }: { value: TimeRange; onChange: (value: TimeRange) => void }) {
  const hasValue = Boolean(value.from || value.to);
  const selectedRange = React.useMemo<DateRange | undefined>(() => {
    if (!value.from && !value.to) return undefined;
    return { from: value.from, to: value.to };
  }, [value.from, value.to]);

  const handleDateSelect = (range: DateRange | undefined) => {
    if (!range?.from && !range?.to) {
      onChange({});
      return;
    }
    onChange({
      from: range.from ? mergeDateAndTime(range.from, value.from, "start") : undefined,
      to: range.to ? mergeDateAndTime(range.to, value.to, "end") : undefined
    });
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-[11px] font-medium text-radar-ink-muted">帖子时间</label>
        {hasValue ? (
          <button
            className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange({})}
            type="button"
          >
            清空
          </button>
        ) : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="h-9 w-full justify-start rounded-xl border-radar-line bg-radar-surface-soft px-2.5 text-left text-xs font-normal text-radar-ink shadow-none hover:bg-radar-surface-soft/80"
            variant="outline"
          >
            <HugeiconsIcon icon={Calendar03Icon} className="h-3.5 w-3.5 text-radar-ink-muted" />
            <span className={hasValue ? "truncate" : "truncate text-radar-ink-muted"}>{formatTimeRangeLabel(value)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[42rem] overflow-hidden p-0">
          <div className="border-b border-radar-line px-4 py-3">
            <p className="text-sm font-semibold text-radar-ink">选择帖子时间范围</p>
            <p className="mt-1 text-xs text-radar-ink-muted">先选日期范围，再按需调整开始和结束时间。</p>
          </div>
          <Calendar
            defaultMonth={value.from ?? value.to}
            mode="range"
            numberOfMonths={2}
            onSelect={handleDateSelect}
            selected={selectedRange}
          />
          <div className="grid grid-cols-2 gap-3 border-t border-radar-line bg-radar-surface-soft/45 p-3">
            <RangeTimeInput
              disabled={!value.from}
              label="开始时间"
              onChange={(time) => onChange({ ...value, from: applyTime(value.from, time, "start") })}
              value={formatTimeInput(value.from)}
            />
            <RangeTimeInput
              disabled={!value.to}
              label="结束时间"
              onChange={(time) => onChange({ ...value, to: applyTime(value.to, time, "end") })}
              value={formatTimeInput(value.to)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RangeTimeInput({
  disabled,
  label,
  value,
  onChange
}: {
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-medium text-radar-ink-muted">
      <span>{label}</span>
      <input
        className="h-9 rounded-xl border border-radar-line bg-radar-surface px-2 text-xs text-radar-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        type="time"
        value={value}
      />
    </label>
  );
}

function ReaderListItem({ item, active, onSelect }: { item: HackerNewsReaderItem; active: boolean; onSelect: () => void }) {
  const title = item.reading?.translatedTitle || item.displayTitle || item.title;
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
        {item.rank ? <span className="rounded-full bg-radar-surface-soft px-1.5">HN #{item.rank}</span> : null}
        {item.points !== null ? <span className="rounded-full bg-radar-surface-soft px-1.5">{formatCompactNumber(item.points)} 分</span> : null}
        <span className="rounded-full bg-radar-surface-soft px-1.5">{formatCompactNumber(item.commentCount)} 评论</span>
        {item.reading ? <span className="rounded-full bg-primary/10 px-1.5 font-medium text-primary">已翻译</span> : <span>待翻译</span>}
      </div>
      {item.publishedAt ? <p className="mt-1 text-[11px] text-radar-ink-muted">{formatRelativeTime(item.publishedAt)}</p> : null}
    </button>
  );
}

function ReaderDetail({ item }: { item: HackerNewsReaderItem }) {
  const reading = item.reading;
  const discussion = item.discussion;
  const title = reading?.translatedTitle || item.displayTitle || item.title;
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [item.id]);

  return (
    <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto" ref={scrollRef}>
      <header className="border-b border-radar-line px-5 py-4">
        <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-radar-ink-muted">
              <span>质量分 {formatCompactNumber(item.score)}</span>
              {item.quality ? <span>{qualityVerdictLabel(item.quality.verdict)}</span> : null}
              {item.author ? <span>@{item.author}</span> : null}
              {item.publishedAt ? <span>{formatRelativeTime(item.publishedAt)}</span> : null}
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-radar-ink">{title}</h2>
            {title !== item.title ? <p className="mt-2 text-sm leading-6 text-radar-ink-muted">{item.title}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-radar-line bg-radar-surface px-3 text-xs font-medium text-radar-ink-soft transition-colors hover:bg-radar-surface-soft hover:text-radar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={item.commentsUrl ?? `https://news.ycombinator.com/item?id=${item.id}`}
              rel="noreferrer"
              target="_blank"
            >
              <HugeiconsIcon icon={Message02Icon} className="h-3.5 w-3.5" />
              HN 评论
            </a>
            <a
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-radar-line bg-radar-surface px-3 text-xs font-medium text-radar-ink-soft transition-colors hover:bg-radar-surface-soft hover:text-radar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5" />
              原文
            </a>
          </div>
        </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5 px-5 py-5">
        <section>
          <SectionHeading icon={BookTypeIcon} title="中文正文" />
          {reading ? <ArticleBody text={reading.translatedBody} /> : <PendingTranslation item={item} />}
          {reading?.sourceLimitations ? (
            <p className="mt-4 border-l-2 border-radar-line pl-3 text-xs leading-5 text-radar-ink-muted">
              {reading.sourceLimitations}
            </p>
          ) : null}
        </section>

        {reading?.keyPoints.length ? (
          <section>
            <SectionHeading icon={FireIcon} title="关键要点" />
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-radar-ink">
              {reading.keyPoints.map((point) => (
                <li className="pl-1 marker:text-primary" key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {reading?.contextNotes.length ? (
          <section>
            <h3 className="text-sm font-semibold text-radar-ink">背景说明</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-radar-ink">
              {reading.contextNotes.map((note) => (
                <li className="pl-1 marker:text-primary" key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <SectionHeading icon={Message02Icon} title="精选评论" />
          {discussion ? <DiscussionBlock discussion={discussion} /> : <p className="mt-3 text-sm text-radar-ink-muted">这条信息还没有生成评论精选。</p>}
        </section>
      </div>
    </div>
  );
}

function ArticleBody({ text }: { text: string }) {
  const normalized = React.useMemo(() => normalizeMarkdown(text), [text]);
  if (!normalized) return <p className="mt-3 text-sm text-radar-ink-muted">暂无可读正文。</p>;
  return (
    <article className="markdown-body mt-3 w-full text-[15px] leading-7 text-radar-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-semibold leading-8 text-radar-ink first:mt-0">{children}</h2>,
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-6 border-l-2 border-primary pl-3 text-lg font-semibold leading-7 text-radar-ink first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => <h3 className="mb-2 mt-5 text-[15px] font-semibold leading-6 text-radar-ink">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-1.5 mt-4 text-sm font-semibold leading-6 text-radar-ink">{children}</h4>,
          p: ({ children }) => <p className="my-3 leading-7 text-radar-ink">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-radar-ink">{children}</strong>,
          em: ({ children }) => <em className="text-radar-ink">{children}</em>,
          a: ({ children, href }) => (
            <a className="font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary" href={href} rel="noreferrer" target="_blank">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="my-3 grid gap-1.5 border-l border-radar-line pl-4 text-radar-ink">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 grid list-decimal gap-1.5 pl-5 text-radar-ink">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-7 marker:text-primary">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-radar-blue-ink bg-radar-blue/35 px-3 py-2 text-sm leading-6 text-radar-blue-ink">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className);
            if (!isBlock) {
              return <code className="rounded-md bg-radar-surface-soft px-1.5 py-0.5 font-mono text-[0.92em] text-radar-ink">{children}</code>;
            }
            return <code className="font-mono text-[13px] leading-6 text-primary-foreground">{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-xl border border-radar-line bg-radar-ink px-4 py-3 shadow-sm">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-radar-line">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-radar-line bg-radar-surface-soft px-3 py-2 text-left font-semibold text-radar-ink">{children}</th>,
          td: ({ children }) => <td className="border-b border-radar-line px-3 py-2 text-radar-ink">{children}</td>,
          hr: () => <hr className="my-6 border-radar-line" />
        }}
      >
        {normalized}
      </ReactMarkdown>
    </article>
  );
}

function PendingTranslation({ item }: { item: HackerNewsReaderItem }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-radar-line px-4 py-5">
      <p className="text-sm font-medium text-radar-ink">这条信息还没有生成中文全文。</p>
      <p className="mt-2 text-sm leading-6 text-radar-ink-muted">
        下一次采集会尝试抓取原文并翻译。当前可先参考已有摘要：{item.summary ?? "暂无摘要。"}
      </p>
    </div>
  );
}

function DiscussionBlock({ discussion }: { discussion: NonNullable<HackerNewsReaderItem["discussion"]> }) {
  return (
    <div className="mt-3 grid gap-3">
      {discussion.summary ? <p className="text-sm leading-6 text-radar-ink">{discussion.summary}</p> : null}
      {discussion.keyInsights.length ? (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-radar-ink">
          {discussion.keyInsights.map((insight) => (
            <li className="pl-1 marker:text-primary" key={insight}>{insight}</li>
          ))}
        </ul>
      ) : null}
      {discussion.featuredComments.length ? (
        <div className="grid gap-4">
          {discussion.featuredComments.map((comment) => (
            <article className="border-l-2 border-radar-line pl-3" key={comment.id}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-radar-ink-muted">
                <span>{comment.author ? `@${comment.author}` : "HN 用户"}</span>
                {comment.stance ? <span className="rounded-full bg-radar-surface-soft px-2 py-0.5">{comment.stance}</span> : null}
                <span>价值 {formatCompactNumber(comment.qualityScore)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-radar-ink">{comment.text}</p>
              {comment.reason ? <p className="mt-2 text-xs leading-5 text-radar-ink-muted">入选原因：{comment.reason}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <HugeiconsIcon icon={icon} className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-radar-ink">{title}</h3>
    </div>
  );
}

function EmptyReader() {
  return (
    <div className="flex min-h-[24rem] items-center justify-center rounded-card border border-dashed border-radar-line bg-radar-surface/70 px-4 text-center">
      <div>
        <HugeiconsIcon icon={BookTypeIcon} className="mx-auto h-8 w-8 text-radar-ink-muted" />
        <p className="mt-3 text-sm font-medium text-radar-ink">暂无 HN 数据</p>
        <p className="mt-1 text-xs text-radar-ink-muted">先完成一次采集后，这里会显示中文阅读内容。</p>
      </div>
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <section className="flex w-full flex-col gap-4">
      <div className="h-24 animate-pulse rounded-card bg-radar-surface/70" />
      <div className="grid min-h-[calc(100dvh-13rem)] gap-3 xl:grid-cols-[23rem_minmax(0,1fr)]">
        <div className="animate-pulse rounded-card bg-radar-surface/70" />
        <div className="animate-pulse rounded-card bg-radar-surface/70" />
      </div>
    </section>
  );
}

function qualityVerdictLabel(verdict: string) {
  if (verdict === "high") return "高质量";
  if (verdict === "medium") return "中等质量";
  if (verdict === "low") return "低质量";
  return "待判断";
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 1
  }).format(value);
}

function formatRelativeTime(value: string) {
  const deltaSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(deltaSeconds);
  if (absSeconds < 60) return "刚刚";
  if (absSeconds < 3600) return relativeFormatter.format(Math.round(deltaSeconds / 60), "minute");
  if (absSeconds < 86_400) return relativeFormatter.format(Math.round(deltaSeconds / 3600), "hour");
  return relativeFormatter.format(Math.round(deltaSeconds / 86_400), "day");
}

function isInTimeRange(item: HackerNewsReaderItem, range: TimeRange) {
  if (!range.from && !range.to) return true;
  const publishedAt = item.publishedAt ? new Date(item.publishedAt).getTime() : Number.NaN;
  if (!Number.isFinite(publishedAt)) return false;
  const startAt = range.from?.getTime();
  const endAt = range.to?.getTime();
  if (typeof startAt === "number" && publishedAt < startAt) return false;
  if (typeof endAt === "number" && publishedAt > endAt) return false;
  return true;
}

function mergeDateAndTime(date: Date, current: Date | undefined, boundary: "start" | "end") {
  const next = new Date(date);
  if (current) {
    next.setHours(current.getHours(), current.getMinutes(), 0, boundary === "end" ? 999 : 0);
    return next;
  }
  if (boundary === "end") {
    next.setHours(23, 59, 59, 999);
    return next;
  }
  next.setHours(0, 0, 0, 0);
  return next;
}

function applyTime(date: Date | undefined, value: string, boundary: "start" | "end") {
  if (!date || !value) return date;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return date;
  const next = new Date(date);
  next.setHours(hours, minutes, boundary === "end" ? 59 : 0, boundary === "end" ? 999 : 0);
  return next;
}

function formatTimeInput(date: Date | undefined) {
  if (!date) return "";
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function formatTimeRangeLabel(range: TimeRange) {
  if (range.from && range.to) {
    return `${formatRangeDateTime(range.from)} - ${formatRangeDateTime(range.to)}`;
  }
  if (range.from) return `${formatRangeDateTime(range.from)} 之后`;
  if (range.to) return `${formatRangeDateTime(range.to)} 之前`;
  return "选择起止时间";
}

function formatRangeDateTime(date: Date) {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

function normalizeMarkdown(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*```markdown\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

import React from "react";
import { createRoot } from "react-dom/client";
import { BarChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Box,
  CalendarDays,
  CircleHelp,
  Command,
  Database,
  Filter,
  Flame,
  Folder,
  Gauge,
  Globe2,
  History,
  Inbox,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  UserCircle,
  WalletCards
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import "./styles.css";

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

type Trend = {
  status: "new" | "rising" | "stable" | "cooling" | "expired";
  velocity: number;
  observationCount: number;
  peakScore: number;
  peakAt?: string | null;
  rankDelta: number;
  latestRank?: number | null;
};

type RadarItem = {
  id: string;
  sourceId: string;
  sourceName?: string | null;
  sourceType: string;
  title: string;
  displayTitle?: string | null;
  url: string;
  content?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  score: number;
  metricsJson?: Record<string, unknown> | null;
  tagsJson: string[];
  lastSeenAt: string;
  summary?: string | null;
  reason?: string | null;
  aiCategory?: string | null;
  aiSubCategory?: string | null;
  aiRelevanceScore?: number | null;
  aiSummary?: string | null;
  aiReason?: string | null;
  trend?: Trend;
};

type Run = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  collectedCount: number;
  insertedCount: number;
  updatedCount: number;
  error?: string | null;
};

type TokenUsageWindow = {
  key: string;
  label: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  buckets: Array<{
    label: string;
    start: string;
    end: string;
    classificationTokens: number;
    summaryTokens: number;
    totalTokens: number;
    calls: number;
  }>;
  byOperation: Array<{ operation: string; calls: number; totalTokens: number }>;
};

type AuthState = {
  isAuthenticated: boolean;
  username?: string;
};

const sourceOptions = [
  ["", "全部来源"],
  ["source:newsnow-zhihu", "知乎"],
  ["source:newsnow-baidu", "百度"],
  ["source:newsnow-douyin", "抖音"],
  ["source:newsnow-bilibili", "Bilibili"],
  ["source:newsnow-toutiao", "头条"],
  ["source:newsnow-thepaper", "澎湃"],
  ["source:newsnow-ithome", "IT之家"],
  ["type:rss", "RSS 订阅"],
  ["type:github", "GitHub 项目"],
  ["type:hackernews", "Hacker News 热榜"]
] as const;

const categoryOptions = [
  ["", "全部分类"],
  ["tech", "科技"],
  ["ai", "人工智能"],
  ["open_source", "开源"],
  ["security", "安全"],
  ["finance", "金融"],
  ["business", "商业"],
  ["product", "产品"],
  ["society", "社会"],
  ["entertainment", "娱乐"],
  ["other", "其他"]
] as const;

const trendLabel: Record<Trend["status"], string> = {
  new: "新信号",
  rising: "上升",
  stable: "稳定",
  cooling: "降温",
  expired: "过期"
};

const runStatusLabel: Record<string, string> = {
  success: "成功",
  failed: "失败",
  running: "运行中",
  pending: "等待中"
};

const fontOptions = [
  {
    key: "balanced-sans",
    label: "均衡黑体",
    family: `"Microsoft YaHei UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
  },
  {
    key: "soft-ui",
    label: "雅黑正文",
    family: `"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif`
  },
  {
    key: "apple-first",
    label: "黑体醒目",
    family: `"SimHei", "Heiti SC", "PingFang SC", "Microsoft YaHei UI", sans-serif`
  },
  {
    key: "windows-first",
    label: "宋体衬线",
    family: `"SimSun", "Songti SC", "STSong", "Microsoft YaHei UI", serif`
  },
  {
    key: "compact-cn",
    label: "等线清爽",
    family: `"DengXian", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", sans-serif`
  },
  {
    key: "clean-cn",
    label: "楷体温和",
    family: `"KaiTi", "Kaiti SC", "STKaiti", "Microsoft YaHei UI", serif`
  },
  {
    key: "classic-ui",
    label: "仿宋舒展",
    family: `"FangSong", "STFangsong", "Songti SC", "Microsoft YaHei UI", serif`
  },
  {
    key: "jhenghei",
    label: "正黑 UI",
    family: `"Microsoft JhengHei UI", "Microsoft JhengHei", "Microsoft YaHei UI", "PingFang SC", sans-serif`
  },
  {
    key: "dengxian",
    label: "等线",
    family: `"DengXian", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif`
  }
] as const;

type FontKey = (typeof fontOptions)[number]["key"];

function App() {
  const [auth, setAuth] = React.useState<AuthState | null>(null);
  const [fontKey, setFontKey] = React.useState<FontKey>(() => {
    if (typeof window === "undefined") return "balanced-sans";
    const stored = window.localStorage.getItem("information-dashboard-font");
    return fontOptions.some((option) => option.key === stored) ? (stored as FontKey) : "balanced-sans";
  });
  const [items, setItems] = React.useState<RadarItem[]>([]);
  const [runs, setRuns] = React.useState<Run[]>([]);
  const [tokenUsage, setTokenUsage] = React.useState<TokenUsageWindow[]>([]);
  const [query, setQuery] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [isCollecting, setIsCollecting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    const params = new URLSearchParams();
    params.set("limit", "80");
    if (query.trim()) params.set("q", query.trim());
    const parsedSource = parseSourceFilter(sourceFilter);
    if (parsedSource.sourceType) params.set("sourceType", parsedSource.sourceType);
    if (parsedSource.sourceId) params.set("sourceId", parsedSource.sourceId);
    if (category) params.set("category", category);

    const [itemsResponse, runsResponse, usageResponse] = await Promise.all([
      fetch(`/api/items?${params}`, { credentials: "include" }),
      fetch("/api/runs", { credentials: "include" }),
      fetch("/api/usage/tokens", { credentials: "include" })
    ]);

    if (itemsResponse.status === 401) {
      setAuth({ isAuthenticated: false });
      return;
    }

    if (!itemsResponse.ok) throw new Error("无法加载信号列表");

    const itemPayload = await itemsResponse.json();
    const runPayload = runsResponse.ok ? await runsResponse.json() : { runs: [] };
    const usagePayload = usageResponse.ok ? await usageResponse.json() : { windows: [] };
    setItems(itemPayload.items ?? []);
    setRuns(runPayload.runs ?? []);
    setTokenUsage(usagePayload.windows ?? []);
  }, [query, sourceFilter, category]);

  React.useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) =>
        setAuth({
          isAuthenticated: Boolean(payload.authenticated),
          username: payload.user?.username
        })
      )
      .catch(() => setAuth({ isAuthenticated: false }));
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem("information-dashboard-font", fontKey);
  }, [fontKey]);

  React.useEffect(() => {
    if (!auth?.isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    loadData()
      .then(() => setError(null))
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setIsLoading(false));
  }, [auth?.isAuthenticated, loadData]);

  async function collect() {
    setIsCollecting(true);
    setError(null);
    try {
      const response = await fetch("/api/collect", { method: "POST", credentials: "include" });
      if (response.status === 401) {
        setAuth({ isAuthenticated: false });
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsCollecting(false);
    }
  }

  async function login(username: string, password: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error("账号或密码不正确");
    const payload = await response.json();
    setAuth({ isAuthenticated: true, username: payload.user?.username ?? username });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setAuth({ isAuthenticated: false });
    setItems([]);
    setRuns([]);
    setTokenUsage([]);
  }

  if (auth === null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!auth.isAuthenticated) return <LoginPage onLogin={login} />;

  const topScore = Math.max(...items.map((item) => item.score), 1);
  const hotItems = items.filter((item) => item.score >= topScore * 0.72).length;
  const risingItems = items.filter((item) => item.trend?.status === "rising").length;
  const aiItems = items.filter((item) => typeof item.aiRelevanceScore === "number").length;
  const latestRun = runs[0];

  return (
    <DashboardShell
      aiItems={aiItems}
      error={error}
      fontKey={fontKey}
      hotItems={hotItems}
      isCollecting={isCollecting}
      isLoading={isLoading}
      items={items}
      latestRun={latestRun}
      risingItems={risingItems}
      tokenUsage={tokenUsage}
      username={auth?.username}
      onCollect={collect}
      onFontChange={setFontKey}
      onLogout={logout}
    />
  );

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <Header
          isCollecting={isCollecting}
          latestRun={latestRun}
          username={auth?.username}
          onCollect={collect}
          onLogout={logout}
        />

        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={Activity} label="信号总量" value={items.length.toString()} hint="当前筛选范围" />
          <MetricCard icon={Flame} label="高热信号" value={hotItems.toString()} hint="接近峰值分段" />
          <MetricCard icon={TrendingUp} label="上升趋势" value={risingItems.toString()} hint="速度为正的主题" />
          <MetricCard icon={Sparkles} label="智能标注" value={aiItems.toString()} hint="已生成摘要/相关度" />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Toolbar
              category={category}
              query={query}
              sourceFilter={sourceFilter}
              onCategoryChange={setCategory}
              onQueryChange={setQuery}
              onSourceFilterChange={setSourceFilter}
            />

            {error ? <ErrorBanner message={error ?? ""} /> : null}

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">信号队列</h2>
                  <p className="text-xs text-muted-foreground">按综合评分、趋势速度与新鲜度排列</p>
                </div>
                {isLoading ? (
                  <Badge variant="muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    同步中
                  </Badge>
                ) : (
                  <Badge variant="outline">{items.length} 条</Badge>
                )}
              </div>

              <div className="divide-y">
                {items.length === 0 ? (
                  <EmptyState isLoading={isLoading} />
                ) : (
                  items.map((item, index) => (
                    <RadarRow key={item.id} item={item} maxScore={topScore} rank={index + 1} />
                  ))
                )}
              </div>
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <TokenUsagePanel windows={tokenUsage} />
            <InsightPanel items={items} topScore={topScore} />
            <RunsPanel runs={runs} />
          </aside>
        </section>
      </div>
    </main>
  );
}

function DashboardShell({
  aiItems,
  error,
  fontKey,
  hotItems,
  isCollecting,
  isLoading,
  items,
  latestRun,
  risingItems,
  tokenUsage,
  username,
  onCollect,
  onFontChange,
  onLogout
}: {
  aiItems: number;
  error: string | null;
  fontKey: FontKey;
  hotItems: number;
  isCollecting: boolean;
  isLoading: boolean;
  items: RadarItem[];
  latestRun?: Run;
  risingItems: number;
  tokenUsage: TokenUsageWindow[];
  username?: string;
  onCollect: () => void;
  onFontChange: (fontKey: FontKey) => void;
  onLogout: () => void;
}) {
  const selectedFont = fontOptions.find((option) => option.key === fontKey) ?? fontOptions[0];
  const tokenTotal = tokenUsage.find((window) => window.key === "1h")?.totalTokens ?? tokenUsage[0]?.totalTokens ?? 0;
  const latestRunLabel = latestRun ? `${runStatusLabel[latestRun.status] ?? latestRun.status} · ${formatTime(latestRun.startedAt)}` : "等待采集";

  return (
    <main className="min-h-screen overflow-hidden bg-radar-canvas text-radar-ink" style={{ fontFamily: selectedFont.family }}>
      <div className="flex min-h-screen w-full overflow-hidden bg-radar-canvas">
        <DashboardRail />

        <section className="flex min-w-0 flex-1 flex-col">
          <DashboardTopbar fontKey={fontKey} username={username} onFontChange={onFontChange} onLogout={onLogout} />

          <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-5 pt-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <DashboardTab index="01" label="总览" active />
                <DashboardTab index="02" label="来源" />
                <DashboardTab index="03" label="趋势" />
                <DashboardTab index="04" label="智能分析" />
              </div>

              <div className="flex items-center gap-3">
                <button className="hidden h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-4 text-sm font-medium text-radar-ink-soft shadow-card sm:flex">
                  <CalendarDays className="h-4 w-4 text-radar-ink-muted" />
                  近 30 天
                  <span className="text-radar-ink-muted">10 月 16 日 - 11 月 14 日</span>
                </button>
                <Button size="icon" variant="outline" className="rounded-full">
                  <Folder className="h-4 w-4" />
                </Button>
                <Button size="icon" className="rounded-full bg-[#1f2424] text-[#e4ff70] hover:bg-[#1f2424]/90" onClick={onCollect} disabled={isCollecting}>
                  {isCollecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {error ? <ErrorBanner message={error} /> : null}

            <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
              <SummaryPlaceholder items={items.length} hotItems={hotItems} risingItems={risingItems} aiItems={aiItems} />
              <GaugePlaceholder tokenTotal={tokenTotal} />
              <CampaignPlaceholder items={items} isLoading={isLoading} />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatPlaceholder label="信号总量" value={formatNumber(items.length)} trend="+12.98%" />
              <StatPlaceholder label="高热信号" value={formatNumber(hotItems)} trend="+4.98%" dark />
              <StatPlaceholder label="上升趋势" value={formatNumber(risingItems)} trend="+0.17%" />
              <StatPlaceholder label="智能标注" value={formatNumber(aiItems)} marker />
              <StatPlaceholder label="近 1 小时令牌" value={formatNumber(tokenTotal)} trend="+0.12%" />
            </section>

            <section className="grid min-h-0 gap-5 xl:grid-cols-[1fr_0.9fr]">
              <LineChartPlaceholder title="信号速度" />
              <BarChartPlaceholder title="令牌消耗" />
            </section>

            <p className="sr-only">最近采集：{latestRunLabel}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardRail() {
  const icons = [LayoutDashboard, Box, Inbox, WalletCards, Package, Settings, Shield];
  return (
    <aside className="hidden w-[104px] shrink-0 flex-col items-center px-4 py-8 md:flex">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-radar-line bg-radar-surface text-2xl font-medium text-radar-ink-soft">
        信
      </div>
      <nav className="mt-10 flex flex-1 flex-col items-center gap-5">
        {icons.map((Icon, index) => (
          <button
            key={index}
            className={
              index === 0
                ? "flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                : "flex h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted hover:bg-radar-surface hover:text-radar-ink"
            }
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </nav>
      <button className="flex h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted hover:bg-radar-surface hover:text-radar-ink">
        <UserCircle className="h-5 w-5" />
      </button>
    </aside>
  );
}

function DashboardTopbar({
  fontKey,
  username,
  onFontChange,
  onLogout
}: {
  fontKey: FontKey;
  username?: string;
  onFontChange: (fontKey: FontKey) => void;
  onLogout: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-5">
        <h1 className="text-[34px] font-medium leading-none tracking-[-0.01em] text-radar-ink">信息雷达</h1>
        <div className="hidden items-center gap-4 text-radar-ink-muted sm:flex">
          <Command className="h-4 w-4" />
          <CircleHelp className="h-4 w-4" />
        </div>
      </div>

      <div className="hidden h-11 w-full max-w-sm items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-4 text-sm text-radar-ink-muted shadow-card lg:flex">
        <Search className="h-4 w-4" />
        <span>搜索任意内容</span>
      </div>

      <div className="flex items-center gap-3">
        <Select value={fontKey} onValueChange={(value) => onFontChange(value as FontKey)}>
          <SelectTrigger className="hidden h-10 w-[136px] rounded-full border-radar-line bg-radar-surface text-sm shadow-card sm:flex" aria-label="选择字体">
            <SelectValue placeholder="字体" />
          </SelectTrigger>
          <SelectContent>
            {fontOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button className="hidden h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-3 text-sm shadow-card sm:flex">
          <Globe2 className="h-4 w-4 text-[#6f6bd9]" />
          中文
        </button>
        <button className="relative hidden h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted sm:flex">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">9</span>
        </button>
        <button className="hidden h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted sm:flex">
          <MessageSquare className="h-5 w-5" />
        </button>
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-lg font-black text-white">
          雷
        </button>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          {username ?? "退出"}
        </Button>
      </div>
    </header>
  );
}

function DashboardTab({ index, label, active }: { index: string; label: string; active?: boolean }) {
  return (
    <button className={active ? "flex items-center gap-2 font-semibold text-radar-ink" : "flex items-center gap-2 text-radar-ink-muted"}>
      <span className={active ? "flex h-6 w-6 items-center justify-center rounded-full border border-radar-line-strong text-[11px]" : "flex h-6 w-6 items-center justify-center rounded-full border border-radar-line text-[11px]"}>
        {index}
      </span>
      {label}
    </button>
  );
}

function SummaryPlaceholder({
  aiItems,
  hotItems,
  items,
  risingItems
}: {
  aiItems: number;
  hotItems: number;
  items: number;
  risingItems: number;
}) {
  const rows = [
    ["总览", items, "bg-radar-blue text-radar-blue-ink"],
    ["高热信号", hotItems, "bg-radar-purple text-radar-purple-ink"],
    ["上升趋势", risingItems, "bg-radar-pink text-radar-pink-ink"],
    ["智能标注", aiItems, "bg-radar-yellow text-radar-yellow-ink"]
  ] as const;

  return (
    <div className="rounded-card bg-radar-surface p-7 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[28px] font-medium leading-none tracking-[-0.01em]">摘要</h2>
        <span className="text-[#b1b3aa]">•••</span>
      </div>
      <div className="space-y-3">
        {rows.map(([label, value, className]) => (
          <div key={label} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${className}`}>
            <span className="font-medium">{label}</span>
            <span className="rounded-full bg-white/45 px-3 py-1 text-sm font-semibold">{formatNumber(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaugePlaceholder({ tokenTotal }: { tokenTotal: number }) {
  return (
    <div className="relative overflow-hidden rounded-card bg-radar-surface p-7 text-center shadow-card">
      <span className="absolute left-1/2 top-3 -translate-x-1/2 text-[#c3c5bd]">⋮⋮</span>
      <div className="mb-5 flex items-center justify-between text-left">
        <h2 className="text-[24px] font-medium leading-tight tracking-[-0.01em]">令牌消耗前 5</h2>
        <span className="text-[#b1b3aa]">•••</span>
      </div>
      <p className="text-xs text-[#a0a39a]">令牌总量</p>
      <p className="mt-1 text-4xl font-semibold tracking-normal">{formatNumber(tokenTotal || 2985)}</p>
      <div className="mx-auto mt-7 h-36 w-72 max-w-full overflow-hidden">
        <div className="mx-auto h-72 w-72 rounded-full border-[42px] border-[#dceaff] border-b-transparent border-l-[#866be5] border-r-[#fffbb7] border-t-[#ffd1f4]" />
      </div>
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-2xl bg-[#f0efe8] px-5 py-3 shadow-sm">
        <p className="text-lg font-semibold">1,815.67</p>
        <p className="text-xs text-[#868980]">占位数据</p>
      </div>
    </div>
  );
}

function CampaignPlaceholder({ items, isLoading }: { items: RadarItem[]; isLoading: boolean }) {
  const rows = items.slice(0, 5);
  const displayRows: Array<RadarItem | undefined> = rows.length ? rows : Array.from({ length: 5 });
  return (
    <div className="rounded-card bg-radar-surface p-7 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[24px] font-medium leading-tight tracking-[-0.01em]">高分信号</h2>
        <span className="text-[#b1b3aa]">•••</span>
      </div>
      <div className="grid grid-cols-[1fr_70px_70px] gap-3 text-xs font-medium text-[#a2a49d]">
        <span>信号</span>
        <span>评分</span>
        <span>趋势</span>
      </div>
      <div className="mt-3 space-y-3">
        {displayRows.map((item, index) => (
          <div key={item?.id ?? index} className="grid grid-cols-[1fr_70px_70px] items-center gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{item?.displayTitle ?? item?.title ?? (isLoading ? "加载中..." : "占位信号")}</span>
            <span className="font-semibold text-[#777970]">{formatNumber(item?.score ?? 0)}</span>
            <span className={index % 2 === 0 ? "font-semibold text-radar-pink-ink" : "font-semibold text-radar-ink"}>{item?.trend?.status ?? "--"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatPlaceholder({
  dark,
  label,
  marker,
  trend,
  value
}: {
  dark?: boolean;
  label: string;
  marker?: boolean;
  trend?: string;
  value: string;
}) {
  return (
    <div className={dark ? "rounded-card bg-primary p-5 text-primary-foreground shadow-card" : "rounded-card border border-radar-line bg-radar-surface p-5 shadow-card"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={dark ? "text-sm font-semibold text-primary-foreground" : "text-sm font-semibold text-radar-ink"}>{label}</p>
          <p className={dark ? "mt-1 text-xs text-white/55" : "mt-1 text-xs text-[#9b9d95]"}>10 月 16 日 - 11 月 14 日</p>
        </div>
        <span className={dark ? "text-white/45" : "text-[#b4b6ad]"}>•••</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xl font-semibold tracking-normal">{value}</p>
        {marker ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b403f] text-[#dfff58]">=</span>
        ) : (
          <span className={dark ? "rounded-full bg-[#ffd7ff] px-3 py-1 text-xs font-semibold text-[#7a3b80]" : "rounded-full bg-[#ddff75] px-3 py-1 text-xs font-semibold text-[#4a641d]"}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function LineChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-card bg-radar-surface p-7 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[24px] font-medium leading-tight tracking-[-0.01em]">{title}</h2>
        <div className="flex items-center gap-4 text-xs text-[#8e9188]">
          <span>8 月 21 日 - 9 月 21 日</span>
          <span className="text-[#c325c8]">● 成本</span>
          <span className="text-[#846de0]">● 曝光</span>
          <span className="text-[#d9ef59]">● 概率</span>
        </div>
      </div>
      <div className="relative h-52 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#eceee7_1px,transparent_1px)] bg-[length:100%_40px]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 210" preserveAspectRatio="none">
          <path d="M0 150 C70 100 110 90 150 54 S240 120 290 72 385 76 440 135 530 65 600 80" fill="none" stroke="#8a6be4" strokeWidth="4" />
          <path d="M0 160 C80 120 120 112 170 76 S230 90 270 82 360 96 400 126 520 142 600 100" fill="none" stroke="#c325c8" strokeWidth="4" />
          <path d="M0 178 C80 135 100 150 150 120 S240 160 290 130 350 138 410 170 520 190 600 145" fill="none" stroke="#d9ef59" strokeWidth="4" />
        </svg>
      </div>
    </div>
  );
}

function BarChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-card bg-radar-surface p-7 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[24px] font-medium leading-tight tracking-[-0.01em]">{title}</h2>
        <div className="flex items-center gap-4 text-xs text-[#8e9188]">
          <span>8 月 21 日 - 9 月 21 日</span>
          <span className="text-[#d6caff]">● 消耗</span>
          <span className="text-[#876de0]">● 转化</span>
        </div>
      </div>
      <div className="relative h-52 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#eceee7_1px,transparent_1px)] bg-[length:100%_40px]" />
        <div className="absolute bottom-10 left-[26%] h-32 w-20 rounded-2xl bg-[#d9ccff]">
          <div className="absolute bottom-0 h-20 w-full rounded-b-2xl bg-[#866be5]" />
        </div>
        <div className="absolute bottom-10 right-[26%] h-36 w-20 rounded-2xl bg-[#d9ccff]">
          <div className="absolute bottom-0 h-20 w-full rounded-b-2xl bg-[#866be5]" />
        </div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 210" preserveAspectRatio="none">
          <path d="M130 145 L250 118 L370 90" fill="none" stroke="#5a5d57" strokeWidth="3" />
          <circle cx="130" cy="145" r="7" fill="#f7f7f2" stroke="#5a5d57" strokeWidth="3" />
          <circle cx="370" cy="90" r="7" fill="#f7f7f2" stroke="#5a5d57" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onLogin(username.trim(), password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">登录信息雷达</CardTitle>
          <CardDescription>输入账号密码后进入工作台。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <Input
              autoComplete="username"
              placeholder="账号"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Input
              autoComplete="current-password"
              placeholder="密码"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="w-full" disabled={isSubmitting || !username.trim() || !password} type="submit">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {isSubmitting ? "登录中" : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Header({
  isCollecting,
  latestRun,
  username,
  onCollect,
  onLogout
}: {
  isCollecting: boolean;
  latestRun?: Run;
  username?: string;
  onCollect: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-lg border bg-card px-4 py-4 shadow-claude sm:px-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Database className="h-3.5 w-3.5" />
            信息雷达
          </Badge>
          {latestRun ? (
            <Badge variant={latestRun.status === "success" ? "success" : latestRun.status === "failed" ? "destructive" : "outline"}>
              最近采集：{runStatusLabel[latestRun.status] ?? latestRun.status} · {formatTime(latestRun.startedAt)}
            </Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
          信息雷达工作台
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          把分散来源收敛成可判断的信号流，优先看热度、趋势、智能摘要和采集健康度。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {username ? <Badge variant="outline">{username}</Badge> : null}
        <Button onClick={onCollect} disabled={isCollecting}>
          {isCollecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isCollecting ? "采集中" : "立即采集"}
        </Button>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          退出
        </Button>
      </div>
    </header>
  );
}

function Toolbar({
  category,
  query,
  sourceFilter,
  onCategoryChange,
  onQueryChange,
  onSourceFilterChange
}: {
  category: string;
  query: string;
  sourceFilter: string;
  onCategoryChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
}) {
  return (
    <Card className="p-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_190px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索标题、正文或摘要"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <Select value={sourceFilter || "all"} onValueChange={(value) => onSourceFilterChange(value === "all" ? "" : value)}>
          <SelectTrigger aria-label="筛选来源">
            <SelectValue placeholder="全部来源" />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map(([value, label]) => (
              <SelectItem key={value || "all"} value={value || "all"}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select
            value={category || "all"}
            onValueChange={(value) => onCategoryChange(value === "all" ? "" : value)}
          >
            <SelectTrigger className="pl-9" aria-label="筛选分类">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map(([value, label]) => (
                <SelectItem key={value || "all"} value={value || "all"}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function RadarRow({ item, maxScore, rank }: { item: RadarItem; maxScore: number; rank: number }) {
  const width = `${Math.max(7, (item.score / maxScore) * 100)}%`;
  const title = item.displayTitle || item.title;
  const summary = item.aiSummary ?? item.summary ?? item.content ?? "暂无摘要";
  const breakdown = item.metricsJson?.scoreBreakdown as
    | {
        rankScore?: number;
        engagementScore?: number;
        freshnessScore?: number;
        persistenceScore?: number;
        sourceScore?: number;
        keywordScore?: number;
      }
    | undefined;

  return (
    <article className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/35 sm:px-5 lg:grid-cols-[44px_minmax(0,1fr)_92px]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-semibold text-muted-foreground">
        {rank}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="source">{sourceDisplayName(item)}</Badge>
          {item.aiCategory ? <Badge variant="accent">{categoryLabel(item.aiCategory)}</Badge> : null}
          {item.trend ? <TrendBadge trend={item.trend} /> : null}
        </div>

        <a
          className="group inline-flex max-w-full items-start gap-1.5 text-base font-semibold leading-6 text-foreground underline-offset-4 hover:text-primary hover:underline"
          href={item.url}
          rel="noreferrer"
          target="_blank"
        >
          <span className="line-clamp-2 min-w-0">{title}</span>
          <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
        </a>
        {item.displayTitle && item.displayTitle !== item.title ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">原标题：{item.title}</p>
        ) : null}

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{summary}</p>

        {breakdown ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <TinyStat label="排名" value={breakdown.rankScore} />
            <TinyStat label="互动" value={breakdown.engagementScore} />
            <TinyStat label="新鲜度" value={breakdown.freshnessScore} />
            <TinyStat label="持续性" value={breakdown.persistenceScore} />
            <TinyStat label="来源" value={breakdown.sourceScore} />
            <TinyStat label="关键词" value={breakdown.keywordScore} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {(item.tagsJson ?? []).slice(0, 5).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
          {item.author ? <span>{item.author}</span> : null}
          {typeof item.aiRelevanceScore === "number" ? <span>智能相关度 {item.aiRelevanceScore}</span> : null}
          <span>{formatTime(item.lastSeenAt)}</span>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-2 lg:items-end">
        <div className="text-left lg:text-right">
          <div className="text-2xl font-semibold text-primary">{item.score.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">评分</div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted lg:w-20">
          <span className="block h-full rounded-full bg-primary" style={{ width }} />
        </div>
      </div>
    </article>
  );
}

function InsightPanel({ items, topScore }: { items: RadarItem[]; topScore: number }) {
  const strongest = items[0];
  const sourceCounts = items.reduce<Record<string, number>>((counts, item) => {
    const source = sourceDisplayName(item);
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {});
  const dominantSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <SectionTitle icon={Sparkles} title="今日洞察" />
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">最高评分</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{topScore.toFixed(1)}</p>
          <p className="mt-1 line-clamp-2 text-sm text-foreground">
            {strongest?.title ?? "等待首次采集后生成洞察"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniTile label="主要来源" value={dominantSource ? dominantSource[0] : "-"} />
          <MiniTile label="趋势样本" value={items.filter((item) => item.trend).length.toString()} />
        </div>
      </CardContent>
    </Card>
  );
}

function RunsPanel({ runs }: { runs: Run[] }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <SectionTitle icon={History} title="采集记录" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
      <div className="divide-y">
        {runs.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">暂无采集记录</p>
        ) : (
          runs.slice(0, 8).map((run) => (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-3" key={run.id}>
              <Badge variant={run.status === "success" ? "success" : run.status === "failed" ? "destructive" : "outline"}>
                {runStatusLabel[run.status] ?? run.status}
              </Badge>
              <strong className="text-sm font-semibold">{run.collectedCount}</strong>
              <span className="text-xs text-muted-foreground">
                新增 {run.insertedCount} / 更新 {run.updatedCount}
              </span>
              <span className="text-right text-xs text-muted-foreground">{formatTime(run.startedAt)}</span>
            </div>
          ))
        )}
      </div>
      </CardContent>
    </Card>
  );
}

function TokenUsagePanel({ windows }: { windows: TokenUsageWindow[] }) {
  const [selectedKey, setSelectedKey] = React.useState("5m");
  const chartRef = React.useRef<HTMLDivElement | null>(null);
  const selected = windows.find((window) => window.key === selectedKey) ?? windows[0];

  React.useEffect(() => {
    if (!chartRef.current || !selected) return;

    const buckets = selected.buckets ?? [];
    const chart = init(chartRef.current);
    chart.setOption({
      color: ["#0f8b6f", "#8a6f3f"],
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "#66736d", fontSize: 12 }
      },
      grid: { left: 36, right: 12, top: 34, bottom: 30 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value: unknown) => formatNumber(Number(value ?? 0))
      },
      xAxis: {
        type: "category",
        data: buckets.map((bucket) => bucket.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#dbe4dc" } },
        axisLabel: { color: "#66736d", fontSize: 12, interval: "auto" }
      },
      yAxis: {
        type: "value",
        name: "Tokens",
        nameTextStyle: { color: "#66736d", fontSize: 11 },
        splitLine: { lineStyle: { color: "#edf1ed" } },
        axisLabel: {
          color: "#66736d",
          formatter: (value: number) => compactNumber(value)
        }
      },
      series: [
        {
          name: "分类",
          type: "bar",
          stack: "tokens",
          barMaxWidth: 24,
          data: buckets.map((bucket) => bucket.classificationTokens)
        },
        {
          name: "摘要",
          type: "bar",
          stack: "tokens",
          barMaxWidth: 24,
          data: buckets.map((bucket) => bucket.summaryTokens),
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }
      ]
    });

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [selected]);

  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle icon={Sparkles} title="Token 消耗" />
          <Select value={selected?.key ?? selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger className="h-8 w-24" aria-label="选择 Token 统计窗口">
              <SelectValue placeholder="窗口" />
            </SelectTrigger>
            <SelectContent>
              {windows.map((window) => (
                <SelectItem key={window.key} value={window.key}>
                  {window.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">最近 {selected?.label ?? "5m"}</p>
          <p className="mt-1 text-2xl font-semibold text-primary">
            {formatNumber(selected?.totalTokens ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            调用 {selected?.calls ?? 0} 次 / 输入 {formatNumber(selected?.promptTokens ?? 0)} / 输出{" "}
            {formatNumber(selected?.completionTokens ?? 0)}
          </p>
        </div>
        <div ref={chartRef} className="h-52 w-full" />
        <div className="grid grid-cols-2 gap-2">
          {(selected?.byOperation ?? []).map((item) => (
            <MiniTile
              key={item.operation}
              label={item.operation === "classification" ? "分类" : "摘要"}
              value={`${formatNumber(item.totalTokens)} / ${item.calls} 次`}
            />
          ))}
          {!selected?.byOperation?.length ? (
            <p className="col-span-2 text-sm text-muted-foreground">暂无 Token 使用记录</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
        </div>
        <div className="rounded-md bg-secondary p-2 text-secondary-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      {isLoading ? <Loader2 className="mb-3 h-5 w-5 animate-spin text-primary" /> : <Database className="mb-3 h-5 w-5 text-muted-foreground" />}
      <p className="text-sm font-medium">{isLoading ? "正在同步信号" : "还没有匹配的信号"}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {isLoading ? "数据加载完成后会自动刷新列表。" : "调整搜索条件，或点击立即采集获取新的信息源。"}
      </p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-md bg-muted p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <CardTitle>{title}</CardTitle>
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value?: number }) {
  return (
    <span className="rounded-sm border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
      {label} {value ?? 0}
    </span>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  return (
    <Badge
      variant={
        trend.status === "rising" || trend.status === "new"
          ? "success"
          : trend.status === "cooling" || trend.status === "expired"
            ? "warning"
            : "outline"
      }
    >
      {trendLabel[trend.status]}
      {trend.velocity !== 0 ? ` 速度 ${trend.velocity > 0 ? "+" : ""}${trend.velocity}` : null}
    </Badge>
  );
}

function sourceLabel(sourceType: string) {
  const match = sourceOptions.find(([value]) => value === `type:${sourceType}`);
  return match?.[1] ?? sourceType;
}

function parseSourceFilter(value: string) {
  if (value.startsWith("type:")) return { sourceType: value.slice("type:".length), sourceId: "" };
  if (value.startsWith("source:")) return { sourceType: "", sourceId: value.slice("source:".length) };
  return { sourceType: "", sourceId: "" };
}

function sourceDisplayName(item: Pick<RadarItem, "sourceName" | "sourceId" | "sourceType">) {
  return item.sourceName || sourceNameFromId(item.sourceId) || sourceLabel(item.sourceType);
}

function sourceNameFromId(sourceId: string) {
  const names: Record<string, string> = {
    "newsnow-zhihu": "知乎",
    "newsnow-baidu": "百度",
    "newsnow-douyin": "抖音",
    "newsnow-bilibili": "Bilibili",
    "newsnow-toutiao": "头条",
    "newsnow-thepaper": "澎湃",
    "newsnow-ithome": "IT之家"
  };
  return names[sourceId];
}

function categoryLabel(category: string) {
  const match = categoryOptions.find(([value]) => value === category);
  return match?.[1] ?? category;
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}k`;
  return `${value}`;
}

createRoot(document.getElementById("root")!).render(<App />);

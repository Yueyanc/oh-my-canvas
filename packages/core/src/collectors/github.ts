import { JSDOM } from "jsdom";
import type { CollectedItem, SourceConfig } from "../types";

type TrendingRepo = {
  author?: string;
  name?: string;
  avatar?: string;
  url?: string;
  description?: string;
  language?: string;
  languageColor?: string;
  stars?: number;
  forks?: number;
  currentPeriodStars?: number;
  builtBy?: Array<{ href?: string; avatar?: string; username?: string }>;
};

export async function collectGithub(source: SourceConfig): Promise<CollectedItem[]> {
  if (source.query === "trending" || source.since) return collectGithubTrending(source);
  if (!source.query) throw new Error(`GitHub source ${source.id} requires query`);
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", source.query);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "20");

  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "information-radar" }
  });
  if (!response.ok) throw new Error(`GitHub fetch failed for ${source.name}: ${response.status}`);
  const payload = (await response.json()) as { items?: any[] };

  return (payload.items ?? []).map((repo) => ({
    sourceId: source.id,
    sourceType: "github",
    title: repo.full_name,
    url: repo.html_url,
    content: repo.description,
    author: repo.owner?.login,
    publishedAt: repo.updated_at,
    metrics: {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      language: repo.language
    },
    raw: repo
  }));
}

async function collectGithubTrending(source: SourceConfig): Promise<CollectedItem[]> {
  const since = source.since ?? "daily";
  const limit = source.limit ?? 25;
  const endpoint = new URL(source.url ?? "https://ghapi.huchen.dev/repositories");
  endpoint.searchParams.set("since", since);
  if (source.query && source.query !== "trending") endpoint.searchParams.set("language", source.query);

  let payload: TrendingRepo[];
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "information-radar" }
    });
    if (!response.ok) throw new Error(`GitHub Trending fetch failed for ${source.name}: ${response.status}`);
    payload = (await response.json()) as TrendingRepo[];
  } catch (error) {
    payload = await scrapeGithubTrendingPage(since, source.query && source.query !== "trending" ? source.query : undefined);
    if (!payload.length) throw error;
  }

  return payload.slice(0, limit).flatMap((repo, index) => {
    if (!repo.url || !repo.name) return [];
    const fullName = repo.author ? `${repo.author}/${repo.name}` : repo.name;
    return [
      {
        sourceId: source.id,
        sourceType: "github" as const,
        title: fullName,
        url: repo.url,
        content: repo.description,
        author: repo.author,
        publishedAt: new Date().toISOString(),
        metrics: {
          rank: index + 1,
          githubTrendingPeriod: since,
          stars: repo.stars ?? 0,
          forks: repo.forks ?? 0,
          currentPeriodStars: repo.currentPeriodStars ?? 0,
          language: repo.language ?? "",
          languageColor: repo.languageColor ?? "",
          builtBy: repo.builtBy ?? [],
          avatar: repo.avatar ?? "",
          repository: fullName
        },
        raw: repo
      }
    ];
  });
}

async function scrapeGithubTrendingPage(since: string, language?: string): Promise<TrendingRepo[]> {
  const url = new URL(language ? `https://github.com/trending/${language}` : "https://github.com/trending");
  url.searchParams.set("since", since);
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
      "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8",
      "user-agent": "Mozilla/5.0 InformationRadar/0.1"
    }
  });
  if (!response.ok) return [];
  const dom = new JSDOM(await response.text(), { url: "https://github.com/trending" });
  const document = dom.window.document;
  return Array.from(document.querySelectorAll("article.Box-row")).flatMap((article) => {
    const link = article.querySelector<HTMLAnchorElement>("h2 a");
    const href = link?.getAttribute("href")?.trim();
    if (!href) return [];
    const [author, name] = href.replace(/^\/+/, "").split("/");
    if (!author || !name) return [];
    const description = article.querySelector("p")?.textContent?.replace(/\s+/g, " ").trim();
    const languageNode = article.querySelector("[itemprop='programmingLanguage']");
    const numberLinks = Array.from(article.querySelectorAll<HTMLAnchorElement>("a.Link--muted")).map((node) => node.textContent ?? "");
    const stars = parseNumber(numberLinks[0]);
    const forks = parseNumber(numberLinks[1]);
    const currentPeriodStars = parseNumber(article.querySelector("span.d-inline-block.float-sm-right")?.textContent ?? "");
    const builtBy = Array.from(article.querySelectorAll<HTMLAnchorElement>("span:has(a[data-hovercard-type='user']) a")).map((node) => ({
      href: `https://github.com${node.getAttribute("href") ?? ""}`,
      avatar: node.querySelector("img")?.getAttribute("src") ?? "",
      username: node.getAttribute("href")?.replace("/", "") ?? ""
    }));
    return [
      {
        author,
        name,
        avatar: `https://github.com/${author}.png`,
        url: `https://github.com/${author}/${name}`,
        description,
        language: languageNode?.textContent?.trim(),
        stars,
        forks,
        currentPeriodStars,
        builtBy
      }
    ];
  });
}

function parseNumber(value: string) {
  const normalized = value.replace(/,/g, "").match(/\d+/)?.[0];
  return normalized ? Number(normalized) : 0;
}

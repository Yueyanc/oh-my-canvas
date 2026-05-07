import type { CollectedItem, SourceConfig } from "../types";

export async function collectGithub(source: SourceConfig): Promise<CollectedItem[]> {
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

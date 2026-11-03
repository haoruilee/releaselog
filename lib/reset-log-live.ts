import { cache } from "react";
import { RESET_EVENTS, type ResetEvent } from "@/data/reset-log";
import discoverySources from "@/data/reset-discovery-sources.json";
import currentSeeds from "@/data/reset-current-seeds.json";
import { mergeResetEvents, parseSourcePost, parseCodexRecord, sourcePost } from "./reset-feed-core";

const fixedSeeds = currentSeeds as ResetEvent[];
async function fetchPublic(url: string): Promise<Response> {
  const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000), headers: { "User-Agent": "ReleaseLog/1.0 (+https://releaselog.site/sources)" } });
  if (!response.ok) throw new Error(`reset_source_http_${response.status}`);
  return response;
}
async function codexArchive(): Promise<ResetEvent[]> {
  const data = await (await fetchPublic("https://willcodexresets.com/api/resets?limit=100")).json();
  return (Array.isArray(data.resets) ? data.resets.slice(0, 100) : []).map((r: unknown) => parseCodexRecord(r)).filter((r: ResetEvent | null): r is ResetEvent => Boolean(r));
}
async function archivedPosts(knownEvents: ResetEvent[]): Promise<ResetEvent[]> {
  const archives = await Promise.allSettled(discoverySources.filter(s => s.format !== "json").map(async s => (await fetchPublic(s.url)).text()));
  const links = archives.flatMap(r => r.status === "fulfilled" ? [...r.value.matchAll(/https:\/\/(?:x|twitter)\.com\/([a-zA-Z0-9_]+)\/status\/(\d{10,24})/g)].map(m => m[0]) : []);
  const known = new Set(knownEvents.map(e => sourcePost(e.source.url)?.id));
  const posts = [...new Map(links.map(url => { const p=sourcePost(url); return [p?.id, p]; })).values()].filter(p => p && !known.has(p.id)).slice(0, 24);
  const events: ResetEvent[] = [];
  for (let i=0; i<posts.length; i+=6) {
    const batch = await Promise.allSettled(posts.slice(i,i+6).map(async p => {
      const data = await (await fetchPublic(`https://api.fxtwitter.com/${p!.author}/status/${p!.id}`)).json();
      return parseSourcePost(data.tweet);
    }));
    for (const result of batch) if (result.status === "fulfilled" && result.value) events.push(result.value);
  }
  return events;
}

export const getLiveResetEvents = cache(async (): Promise<ResetEvent[]> => {
  if (process.env.RESET_SOURCES_ENABLED === "0") return mergeResetEvents(RESET_EVENTS, fixedSeeds);
  // Keep all published slugs stable. Prefer verified editorial seeds over imported duplicates.
  const codex = await codexArchive().catch(() => []);
  const additional = await archivedPosts([...RESET_EVENTS, ...fixedSeeds, ...codex]).catch(() => []);
  return mergeResetEvents(RESET_EVENTS, fixedSeeds, codex, additional);
});
export async function getLiveResetEventBySlug(slug: string): Promise<ResetEvent | undefined> {
  return (await getLiveResetEvents()).find(e => e.slug === slug);
}

import type { EntityConfig, ReleaseAudience, ReleaseItem, ReleaseStatus } from "@/data/types";
import { isReleaseAudience, isReleaseStatus } from "@/data/types";

export type ReleaseQuery = {
  from?: string;
  to?: string;
  tag?: string;
  audience?: ReleaseAudience;
  status?: ReleaseStatus;
  offset?: number;
  limit?: number;
};

function parseIntParam(v: string | null, fallback: number): number {
  if (v === null || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Filters and pagination only (no date range). */
export function parseReleaseFilters(searchParams: URLSearchParams): ReleaseQuery {
  const tag = searchParams.get("tag") ?? undefined;
  const audienceRaw = searchParams.get("audience");
  const audience =
    audienceRaw && isReleaseAudience(audienceRaw) ? audienceRaw : undefined;
  const statusRaw = searchParams.get("status");
  const status = statusRaw && isReleaseStatus(statusRaw) ? statusRaw : undefined;
  const offset = Math.max(0, parseIntParam(searchParams.get("offset"), 0));
  const limitRaw = searchParams.get("limit");
  const limit =
    limitRaw === null || limitRaw === ""
      ? 200
      : Math.min(500, Math.max(1, parseIntParam(limitRaw, 200)));
  return { tag, audience, status, offset, limit };
}

export function parseReleaseQuery(searchParams: URLSearchParams): ReleaseQuery {
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  return {
    ...parseReleaseFilters(searchParams),
    from,
    to,
  };
}

function matchesAudience(item: ReleaseItem, audience: ReleaseAudience): boolean {
  if (!item.audience) return false;
  const list = Array.isArray(item.audience) ? item.audience : [item.audience];
  return list.includes(audience);
}

export function filterReleases(items: ReleaseItem[], q: ReleaseQuery): ReleaseItem[] {
  let out = items;

  if (q.from) {
    out = out.filter((r) => r.date >= q.from!);
  }
  if (q.to) {
    out = out.filter((r) => r.date <= q.to!);
  }
  if (q.tag) {
    out = out.filter((r) => r.tags?.includes(q.tag!));
  }
  if (q.audience) {
    out = out.filter((r) => matchesAudience(r, q.audience!));
  }
  if (q.status) {
    out = out.filter((r) => r.status === q.status);
  }

  out = [...out].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const ia = a.importance ?? 1;
    const ib = b.importance ?? 1;
    if (ib !== ia) return ib - ia;
    return a.title.localeCompare(b.title);
  });

  const start = q.offset ?? 0;
  const limit = q.limit ?? 200;
  return out.slice(start, start + limit);
}

export function entitySummary(e: EntityConfig) {
  const eventCount = e.releases.filter((item) => item.kind === "event").length;
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    description: e.description,
    headline: e.headline,
    subtitle: e.subtitle,
    footnote: e.footnote,
    brandLine: e.brandLine,
    brandUrl: e.brandUrl,
    members: e.members,
    theme: e.theme,
    releaseCount: e.releases.length - eventCount,
    eventCount,
    logCount: e.releases.length,
  };
}

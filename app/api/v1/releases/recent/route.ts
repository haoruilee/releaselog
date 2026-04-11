import { NextResponse } from "next/server";
import { entities } from "@/data";
import type { ReleaseItem } from "@/data/types";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";
import { filterReleases, parseReleaseFilters } from "@/lib/releases-query";

export const dynamic = "force-static";

function addDaysIso(isoDate: string, delta: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const days = Math.min(
    365,
    Math.max(1, Number.parseInt(url.searchParams.get("days") ?? "30", 10) || 30),
  );
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = addDaysIso(to, -(days - 1));

  const entityFilter = url.searchParams.get("entity") ?? undefined;
  const filters = parseReleaseFilters(url.searchParams);

  const list: Array<ReleaseItem & { entityId: string; entityName: string }> = [];

  for (const e of entities) {
    if (entityFilter && e.id !== entityFilter) continue;
    const merged = { ...filters, from, to, limit: 500, offset: 0 };
    const slice = filterReleases(e.releases, merged);
    for (const r of slice) {
      list.push({
        ...r,
        entityId: e.id,
        entityName: e.name,
      });
    }
  }

  list.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const ia = a.importance ?? 1;
    const ib = b.importance ?? 1;
    if (ib !== ia) return ib - ia;
    return a.title.localeCompare(b.title);
  });

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 200;
  const page = list.slice(offset, offset + limit);

  return NextResponse.json({
    schemaVersion: API_SCHEMA_VERSION,
    from,
    to,
    days,
    query: { ...filters, from, to },
    releases: page,
    total: list.length,
  });
}

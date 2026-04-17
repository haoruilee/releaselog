import { entities, getEntityById, type EntityConfig, type ReleaseItem } from "@/data";
import { ensureDb } from "@/lib/db";
import { sha256, slugify } from "@/lib/security";

type ReleaseRow = {
  id: string;
  entity_id: string;
  date: string;
  title: string;
  short_title: string | null;
  slug: string | null;
  description: string | null;
  what_changed: string | null;
  how_to_steps: unknown;
  how_to_prerequisites: unknown;
  doc_urls: unknown;
  tags: unknown;
  source_url: string | null;
  importance: number;
  audience: unknown;
  status: string | null;
  related_ids: unknown;
  source_candidate_id: string | null;
  created_by_user_id: string | null;
  published_at: Date;
  created_at: Date;
};

export type PublishedReleaseRecord = {
  id: string;
  entityId: string;
  item: ReleaseItem;
  sourceCandidateId: string | null;
  createdByUserId: string | null;
  publishedAt: string;
  createdAt: string;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function rowToPublishedRelease(row: ReleaseRow): PublishedReleaseRecord {
  const audience = asStringArray(row.audience);
  return {
    id: row.id,
    entityId: row.entity_id,
    item: {
      id: row.id,
      date: row.date,
      title: row.title,
      shortTitle: row.short_title ?? undefined,
      slug: row.slug ?? undefined,
      description: row.description ?? undefined,
      whatChanged: row.what_changed ?? undefined,
      howTo:
        asStringArray(row.how_to_steps).length > 0
          ? {
              steps: asStringArray(row.how_to_steps),
              prerequisites:
                asStringArray(row.how_to_prerequisites).length > 0
                  ? asStringArray(row.how_to_prerequisites)
                  : undefined,
            }
          : undefined,
      docUrls: asStringArray(row.doc_urls).length > 0 ? asStringArray(row.doc_urls) : undefined,
      tags: asStringArray(row.tags).length > 0 ? asStringArray(row.tags) : undefined,
      sourceUrl: row.source_url ?? undefined,
      importance: row.importance as 1 | 2 | 3,
      audience:
        audience.length === 0
          ? undefined
          : audience.length === 1
            ? (audience[0] as ReleaseItem["audience"])
            : (audience as ReleaseItem["audience"]),
      status: (row.status as ReleaseItem["status"]) ?? undefined,
      relatedIds: asStringArray(row.related_ids).length > 0 ? asStringArray(row.related_ids) : undefined,
    },
    sourceCandidateId: row.source_candidate_id,
    createdByUserId: row.created_by_user_id,
    publishedAt: row.published_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

function mergeReleases(staticItems: ReleaseItem[], published: PublishedReleaseRecord[]): ReleaseItem[] {
  const merged = new Map<string, ReleaseItem>();
  for (const item of staticItems) {
    merged.set(item.id, item);
  }
  for (const record of published) {
    merged.set(record.item.id, record.item);
  }
  return [...merged.values()].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const ia = a.importance ?? 1;
    const ib = b.importance ?? 1;
    if (ib !== ia) return ib - ia;
    return a.title.localeCompare(b.title);
  });
}

export async function listPublishedReleases(entityId?: string): Promise<PublishedReleaseRecord[]> {
  const sql = await ensureDb();
  if (!sql) return [];
  const rows = entityId
    ? await sql<ReleaseRow[]>`
        select *
        from published_releases
        where entity_id = ${entityId}
        order by date desc, published_at desc
      `
    : await sql<ReleaseRow[]>`
        select *
        from published_releases
        order by date desc, published_at desc
      `;
  return rows.map(rowToPublishedRelease);
}

export async function getPublishedReleaseById(id: string): Promise<PublishedReleaseRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<ReleaseRow[]>`
    select *
    from published_releases
    where id = ${id}
    limit 1
  `;
  return rows[0] ? rowToPublishedRelease(rows[0]) : null;
}

export async function getMergedEntities(): Promise<EntityConfig[]> {
  const published = await listPublishedReleases();
  if (published.length === 0) {
    return entities;
  }
  const byEntity = new Map<string, PublishedReleaseRecord[]>();
  for (const record of published) {
    const list = byEntity.get(record.entityId) ?? [];
    list.push(record);
    byEntity.set(record.entityId, list);
  }
  return entities.map((entity) => ({
    ...entity,
    releases: mergeReleases(entity.releases, byEntity.get(entity.id) ?? []),
  }));
}

export async function getMergedEntityById(id: string): Promise<EntityConfig | undefined> {
  const entity = getEntityById(id);
  if (!entity) return undefined;
  const published = await listPublishedReleases(id);
  if (published.length === 0) return entity;
  return {
    ...entity,
    releases: mergeReleases(entity.releases, published),
  };
}

export function buildReleaseId(entityId: string, date: string, title: string): string {
  const slug = slugify(title) || "release";
  const suffix = sha256(`${entityId}:${date}:${title}`).slice(0, 8);
  return `${entityId}-${date}-${slug}-${suffix}`;
}

export async function createPublishedRelease(args: {
  entityId: string;
  date: string;
  title: string;
  shortTitle?: string;
  slug?: string;
  description?: string;
  whatChanged?: string;
  howToSteps?: string[];
  howToPrerequisites?: string[];
  docUrls?: string[];
  tags?: string[];
  sourceUrl?: string;
  importance?: 1 | 2 | 3;
  audience?: string[];
  status?: string;
  relatedIds?: string[];
  sourceCandidateId?: string;
  createdByUserId?: string;
}): Promise<PublishedReleaseRecord> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const releaseId = buildReleaseId(args.entityId, args.date, args.title);
  const rows = await sql<ReleaseRow[]>`
    insert into published_releases (
      id,
      entity_id,
      date,
      title,
      short_title,
      slug,
      description,
      what_changed,
      how_to_steps,
      how_to_prerequisites,
      doc_urls,
      tags,
      source_url,
      importance,
      audience,
      status,
      related_ids,
      source_candidate_id,
      created_by_user_id,
      published_at,
      created_at
    )
    values (
      ${releaseId},
      ${args.entityId},
      ${args.date},
      ${args.title},
      ${args.shortTitle ?? null},
      ${args.slug ?? null},
      ${args.description ?? null},
      ${args.whatChanged ?? null},
      ${JSON.stringify(args.howToSteps ?? [])}::jsonb,
      ${JSON.stringify(args.howToPrerequisites ?? [])}::jsonb,
      ${JSON.stringify(args.docUrls ?? [])}::jsonb,
      ${JSON.stringify(args.tags ?? [])}::jsonb,
      ${args.sourceUrl ?? null},
      ${args.importance ?? 1},
      ${JSON.stringify(args.audience ?? [])}::jsonb,
      ${args.status ?? null},
      ${JSON.stringify(args.relatedIds ?? [])}::jsonb,
      ${args.sourceCandidateId ?? null},
      ${args.createdByUserId ?? null},
      now(),
      now()
    )
    on conflict (id) do update
    set short_title = excluded.short_title,
        slug = excluded.slug,
        description = excluded.description,
        what_changed = excluded.what_changed,
        how_to_steps = excluded.how_to_steps,
        how_to_prerequisites = excluded.how_to_prerequisites,
        doc_urls = excluded.doc_urls,
        tags = excluded.tags,
        source_url = excluded.source_url,
        importance = excluded.importance,
        audience = excluded.audience,
        status = excluded.status,
        related_ids = excluded.related_ids,
        source_candidate_id = excluded.source_candidate_id,
        created_by_user_id = excluded.created_by_user_id
    returning *
  `;
  return rowToPublishedRelease(rows[0]!);
}

export async function listRecentPublishedReleases(limit = 50): Promise<PublishedReleaseRecord[]> {
  const sql = await ensureDb();
  if (!sql) return [];
  const rows = await sql<ReleaseRow[]>`
    select *
    from published_releases
    order by date desc, published_at desc
    limit ${Math.max(1, limit)}
  `;
  return rows.map(rowToPublishedRelease);
}

export async function listPublishedReleaseStats(): Promise<Array<{ entityId: string; count: number }>> {
  const sql = await ensureDb();
  if (!sql) return [];
  const rows = await sql<Array<{ entity_id: string; count: string }>>`
    select entity_id, count(*)::text as count
    from published_releases
    group by entity_id
    order by count(*) desc, entity_id asc
  `;
  return rows.map((row) => ({ entityId: row.entity_id, count: Number(row.count) || 0 }));
}

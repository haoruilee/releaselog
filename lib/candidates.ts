import { randomUUID } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { entities, type ReleaseItem } from "@/data";
import { ensureDb } from "@/lib/db";
import { enqueueReleaseNotifications } from "@/lib/notification-queue";
import { createPublishedRelease, type PublishedReleaseRecord } from "@/lib/releases-store";
import { sha256 } from "@/lib/security";

export type CandidateStatus = "pending" | "approved" | "rejected";

export type CandidateSource = {
  id: string;
  entityId: string;
  label: string;
  url: string;
  type: "page_change" | "feed";
};

export type ReleaseCandidateRecord = {
  id: string;
  entityId: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceFingerprint: string;
  rawTitle: string;
  rawBody: string | null;
  rawPublishedAt: string | null;
  status: CandidateStatus;
  fetchedAt: string;
  approvedReleaseId: string | null;
  rejectionReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type CandidateRow = {
  id: string;
  entity_id: string;
  source_id: string;
  source_label: string;
  source_url: string;
  source_fingerprint: string;
  raw_title: string;
  raw_body: string | null;
  raw_published_at: Date | null;
  status: CandidateStatus;
  fetched_at: Date;
  approved_release_id: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

function mapCandidate(row: CandidateRow): ReleaseCandidateRecord {
  return {
    id: row.id,
    entityId: row.entity_id,
    sourceId: row.source_id,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    sourceFingerprint: row.source_fingerprint,
    rawTitle: row.raw_title,
    rawBody: row.raw_body,
    rawPublishedAt: row.raw_published_at?.toISOString() ?? null,
    status: row.status,
    fetchedAt: row.fetched_at.toISOString(),
    approvedReleaseId: row.approved_release_id,
    rejectionReason: row.rejection_reason,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function getCandidateSources(): CandidateSource[] {
  return entities
    .filter((entity) => entity.brandUrl)
    .map((entity) => ({
      id: `${entity.id}:brand`,
      entityId: entity.id,
      label: entity.brandLine ?? entity.name,
      url: entity.brandUrl!,
      type: entity.brandUrl?.endsWith(".xml") ? "feed" : "page_change",
    }));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSnapshotFromFeed(xml: string): { title: string; body: string; publishedAt: string | null; fingerprintSource: string } | null {
  try {
    const parsed = xmlParser.parse(xml) as Record<string, unknown>;
    const feed = (parsed.feed ?? parsed.rss) as Record<string, unknown> | undefined;
    if (!feed) return null;
    const entriesRaw =
      (feed.entry as unknown[]) ||
      ((feed.channel as Record<string, unknown> | undefined)?.item as unknown[]) ||
      [];
    const entries = Array.isArray(entriesRaw) ? entriesRaw : [entriesRaw];
    const first = entries
      .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
      .find(Boolean);
    if (!first) return null;
    const title = String(first.title ?? "Feed updated");
    const publishedAt = String(first.updated ?? first.pubDate ?? first.published ?? "") || null;
    const links = [first.link, first.id, first.guid]
      .flatMap((value) => (typeof value === "string" ? [value] : []))
      .join(" ");
    const summary = String(first.summary ?? first.description ?? first.content ?? "").slice(0, 1600);
    return {
      title,
      body: summary,
      publishedAt,
      fingerprintSource: `${title}\n${publishedAt ?? ""}\n${links}\n${summary}`.trim(),
    };
  } catch {
    return null;
  }
}

async function fetchSourceSnapshot(source: CandidateSource): Promise<{
  title: string;
  body: string;
  publishedAt: string | null;
  fingerprint: string;
  metadata: Record<string, unknown>;
}> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "ReleaseLogBot/1.0 (+https://releaselog.example)",
      Accept: "text/html,application/xml,text/xml,application/rss+xml,application/atom+xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`fetch_failed:${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("xml") || body.includes("<feed") || body.includes("<rss")) {
    const feedSnapshot = extractSnapshotFromFeed(body);
    if (feedSnapshot) {
      return {
        title: feedSnapshot.title,
        body: feedSnapshot.body,
        publishedAt: feedSnapshot.publishedAt,
        fingerprint: sha256(feedSnapshot.fingerprintSource),
        metadata: {
          contentType,
          extractor: "feed",
        },
      };
    }
  }

  const text = stripHtml(body);
  const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || `${source.label} updated`;
  const snippet = text.slice(0, 1800);
  return {
    title,
    body: snippet,
    publishedAt: null,
    fingerprint: sha256(snippet),
    metadata: {
      contentType,
      extractor: "page_change",
    },
  };
}

export async function ingestCandidateSources(): Promise<{ checked: number; created: number; unchanged: number }> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const sources = getCandidateSources();
  let created = 0;
  let unchanged = 0;

  for (const source of sources) {
    const snapshot = await fetchSourceSnapshot(source);
    const checkpointRows = await sql<Array<{ last_fingerprint: string | null }>>`
      select last_fingerprint
      from source_checkpoints
      where source_id = ${source.id}
      limit 1
    `;
    const lastFingerprint = checkpointRows[0]?.last_fingerprint ?? null;
    if (lastFingerprint === snapshot.fingerprint) {
      unchanged += 1;
      await sql`
        insert into source_checkpoints (source_id, entity_id, url, last_fingerprint, last_fetched_at)
        values (${source.id}, ${source.entityId}, ${source.url}, ${snapshot.fingerprint}, now())
        on conflict (source_id) do update
        set entity_id = excluded.entity_id,
            url = excluded.url,
            last_fingerprint = excluded.last_fingerprint,
            last_fetched_at = excluded.last_fetched_at
      `;
      continue;
    }

    const duplicate = await sql<Array<{ id: string }>>`
      select id
      from release_candidates
      where source_id = ${source.id}
        and source_fingerprint = ${snapshot.fingerprint}
      limit 1
    `;
    const candidateId = duplicate[0]?.id ?? randomUUID();
    if (!duplicate[0]) {
      await sql`
        insert into release_candidates (
          id,
          entity_id,
          source_id,
          source_label,
          source_url,
          source_fingerprint,
          raw_title,
          raw_body,
          raw_published_at,
          status,
          fetched_at,
          metadata,
          created_at,
          updated_at
        )
        values (
          ${candidateId},
          ${source.entityId},
          ${source.id},
          ${source.label},
          ${source.url},
          ${snapshot.fingerprint},
          ${snapshot.title},
          ${snapshot.body},
          ${snapshot.publishedAt ? new Date(snapshot.publishedAt).toISOString() : null},
          ${"pending"},
          now(),
          ${JSON.stringify(snapshot.metadata)}::jsonb,
          now(),
          now()
        )
      `;
      created += 1;
    } else {
      unchanged += 1;
    }

    await sql`
      insert into source_checkpoints (source_id, entity_id, url, last_fingerprint, last_fetched_at, last_candidate_id)
      values (${source.id}, ${source.entityId}, ${source.url}, ${snapshot.fingerprint}, now(), ${candidateId})
      on conflict (source_id) do update
      set entity_id = excluded.entity_id,
          url = excluded.url,
          last_fingerprint = excluded.last_fingerprint,
          last_fetched_at = excluded.last_fetched_at,
          last_candidate_id = excluded.last_candidate_id
    `;
  }

  return {
    checked: sources.length,
    created,
    unchanged,
  };
}

export async function listCandidates(status?: CandidateStatus): Promise<ReleaseCandidateRecord[]> {
  const sql = await ensureDb();
  if (!sql) return [];
  const rows = status
    ? await sql<CandidateRow[]>`
        select *
        from release_candidates
        where status = ${status}
        order by created_at desc
      `
    : await sql<CandidateRow[]>`
        select *
        from release_candidates
        order by created_at desc
      `;
  return rows.map(mapCandidate);
}

export async function getCandidateById(candidateId: string): Promise<ReleaseCandidateRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<CandidateRow[]>`
    select *
    from release_candidates
    where id = ${candidateId}
    limit 1
  `;
  return rows[0] ? mapCandidate(rows[0]) : null;
}

export async function approveCandidate(args: {
  candidateId: string;
  createdByUserId: string;
  entityId: string;
  date: string;
  title: string;
  shortTitle?: string;
  slug?: string;
  description?: string;
  whatChanged?: string;
  sourceUrl?: string;
  importance?: 1 | 2 | 3;
  tags?: string[];
  docUrls?: string[];
  audience?: string[];
  status?: string;
  relatedIds?: string[];
  howToSteps?: string[];
  howToPrerequisites?: string[];
}): Promise<{ release: PublishedReleaseRecord; notifications: { enqueued: number } }> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  let release: PublishedReleaseRecord;
  try {
    release = await createPublishedRelease({
      entityId: args.entityId,
      date: args.date,
      title: args.title,
      shortTitle: args.shortTitle,
      slug: args.slug,
      description: args.description,
      whatChanged: args.whatChanged,
      sourceUrl: args.sourceUrl,
      importance: args.importance,
      tags: args.tags,
      docUrls: args.docUrls,
      audience: args.audience,
      status: args.status,
      relatedIds: args.relatedIds,
      howToSteps: args.howToSteps,
      howToPrerequisites: args.howToPrerequisites,
      sourceCandidateId: args.candidateId,
      createdByUserId: args.createdByUserId,
    });
  } catch (error) {
    // Unique violation on uq_published_releases_source_candidate:
    // same candidate already approved into a different release (rename).
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      throw new Error("candidate_already_approved");
    }
    throw error;
  }

  await sql`
    update release_candidates
    set status = ${"approved"},
        approved_release_id = ${release.id},
        updated_at = now()
    where id = ${args.candidateId}
  `;

  const notifications = await enqueueReleaseNotifications(release.id);
  return { release, notifications };
}

export async function rejectCandidate(candidateId: string, reason: string): Promise<void> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  await sql`
    update release_candidates
    set status = ${"rejected"},
        rejection_reason = ${reason || "Rejected by admin"},
        updated_at = now()
    where id = ${candidateId}
  `;
}

export function inferDateFromCandidate(candidate: ReleaseCandidateRecord): string {
  if (candidate.rawPublishedAt) {
    return candidate.rawPublishedAt.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function candidateToReleaseDefaults(candidate: ReleaseCandidateRecord): Partial<ReleaseItem> {
  return {
    date: inferDateFromCandidate(candidate),
    title: candidate.rawTitle,
    description: candidate.rawBody ?? undefined,
    sourceUrl: candidate.sourceUrl,
  };
}

import type { ReleaseItem } from "@/data";
import { ensureDb } from "@/lib/db";
import { enqueueReleaseNotifications } from "@/lib/notification-queue";
import { createPublishedRelease, type PublishedReleaseRecord } from "@/lib/releases-store";
import { runIngestCycle } from "@/lib/source-queue";

export type CandidateStatus = "pending" | "approved" | "rejected";

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

export type CandidateIngestError = {
  sourceId: string;
  entityId: string;
  url: string;
  error: string;
};

export type CandidateIngestResult = {
  synced?: number;
  enqueued?: number;
  claimed?: number;
  checked?: number;
  created: number;
  unchanged: number;
  failed: number;
  errors: Array<CandidateIngestError | string>;
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

export async function ingestCandidateSources(): Promise<CandidateIngestResult> {
  return runIngestCycle();
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

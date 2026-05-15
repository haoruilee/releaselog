import { randomUUID } from "node:crypto";
import { ensureDb } from "@/lib/db";
import { enqueueReleaseNotifications } from "@/lib/notification-queue";
import { createPublishedRelease } from "@/lib/releases-store";

type ReviewCandidateRow = {
  id: string;
  entity_id: string;
  source_id: string;
  source_label: string;
  source_url: string;
  raw_title: string;
  raw_body: string | null;
  raw_published_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export type AiReviewCandidate = {
  id: string;
  entityId: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  rawTitle: string;
  rawBody: string | null;
  rawPublishedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AiReviewDecision = {
  candidateId: string;
  action: "approve" | "reject" | "needs_review";
  confidence?: number;
  reason?: string;
  release?: {
    entityId?: string;
    date?: string;
    title?: string;
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
  };
};

export type AiReviewApplyInput = {
  provider: string;
  model?: string;
  command?: string;
  exitCode?: number;
  output?: string;
  error?: string;
  dryRun?: boolean;
  decisions: AiReviewDecision[];
};

function mapCandidate(row: ReviewCandidateRow): AiReviewCandidate {
  return {
    id: row.id,
    entityId: row.entity_id,
    sourceId: row.source_id,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    rawTitle: row.raw_title,
    rawBody: row.raw_body,
    rawPublishedAt: row.raw_published_at?.toISOString() ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

function normalizeDate(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  return fallback;
}

function normalizeStringArray(value: string[] | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()) : [];
}

function inferCandidateDate(candidate: AiReviewCandidate): string {
  return candidate.rawPublishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

export async function listAiReviewCandidates(limit = 12): Promise<AiReviewCandidate[]> {
  const sql = await ensureDb();
  if (!sql) return [];
  const rows = await sql<ReviewCandidateRow[]>`
    select id,
           entity_id,
           source_id,
           source_label,
           source_url,
           raw_title,
           raw_body,
           raw_published_at,
           metadata,
           created_at
    from release_candidates
    where status = 'pending'
    order by created_at desc
    limit ${Math.max(1, Math.min(50, limit))}
  `;
  return rows.map(mapCandidate);
}

export async function applyAiReviewDecisions(input: AiReviewApplyInput): Promise<{
  runId: string;
  applied: number;
  approved: number;
  rejected: number;
  needsReview: number;
  skipped: Array<{ candidateId: string; reason: string }>;
}> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }

  const runId = randomUUID();
  const decisions = Array.isArray(input.decisions) ? input.decisions : [];
  await sql`
    insert into ai_review_runs (
      id,
      provider,
      model,
      status,
      command,
      started_at,
      finished_at,
      exit_code,
      output,
      error,
      metadata
    )
    values (
      ${runId},
      ${input.provider || "unknown"},
      ${input.model ?? null},
      ${input.error ? "failed" : "completed"},
      ${input.command ?? null},
      now(),
      now(),
      ${input.exitCode ?? null},
      ${input.output ?? null},
      ${input.error ?? null},
      ${sql.json({ dryRun: input.dryRun === true, decisionCount: decisions.length } as never)}
    )
  `;

  let approved = 0;
  let rejected = 0;
  let needsReview = 0;
  const skipped: Array<{ candidateId: string; reason: string }> = [];

  for (const decision of decisions) {
    if (!decision?.candidateId) {
      skipped.push({ candidateId: "", reason: "missing_candidate_id" });
      continue;
    }
    const rows = await sql<ReviewCandidateRow[]>`
      select id,
             entity_id,
             source_id,
             source_label,
             source_url,
             raw_title,
             raw_body,
             raw_published_at,
             metadata,
             created_at
      from release_candidates
      where id = ${decision.candidateId}
        and status = 'pending'
      limit 1
    `;
    const candidate = rows[0] ? mapCandidate(rows[0]) : null;
    if (!candidate) {
      skipped.push({ candidateId: decision.candidateId, reason: "candidate_not_pending" });
      continue;
    }

    const reviewNote = {
      provider: input.provider,
      runId,
      action: decision.action,
      confidence: decision.confidence ?? null,
      reason: decision.reason ?? null,
      reviewedAt: new Date().toISOString(),
    };

    if (decision.action === "needs_review") {
      needsReview += 1;
      await sql`
        update release_candidates
        set metadata = metadata || ${sql.json({ aiReview: reviewNote } as never)},
            updated_at = now()
        where id = ${candidate.id}
      `;
      continue;
    }

    if (decision.action === "reject") {
      rejected += 1;
      if (!input.dryRun) {
        await sql`
          update release_candidates
          set status = ${"rejected"},
              rejection_reason = ${decision.reason || "Rejected by AI review"},
              metadata = metadata || ${sql.json({ aiReview: reviewNote } as never)},
              updated_at = now()
          where id = ${candidate.id}
        `;
      }
      continue;
    }

    if (decision.action !== "approve") {
      skipped.push({ candidateId: candidate.id, reason: "unknown_action" });
      continue;
    }

    const confidence = decision.confidence ?? 0;
    const release = decision.release ?? {};
    const title = release.title?.trim() || candidate.rawTitle;
    if (confidence < 0.85) {
      needsReview += 1;
      await sql`
        update release_candidates
        set metadata = metadata || ${sql.json({ aiReview: { ...reviewNote, action: "needs_review", reason: "confidence_below_threshold" } } as never)},
            updated_at = now()
        where id = ${candidate.id}
      `;
      continue;
    }
    if (!title || title.length < 3) {
      skipped.push({ candidateId: candidate.id, reason: "missing_release_title" });
      continue;
    }

    approved += 1;
    if (!input.dryRun) {
      const published = await createPublishedRelease({
        entityId: release.entityId || candidate.entityId,
        date: normalizeDate(release.date, inferCandidateDate(candidate)),
        title,
        shortTitle: release.shortTitle,
        slug: release.slug,
        description: release.description ?? candidate.rawBody ?? undefined,
        whatChanged: release.whatChanged,
        sourceUrl: release.sourceUrl ?? candidate.sourceUrl,
        importance: release.importance,
        tags: normalizeStringArray(release.tags),
        docUrls: normalizeStringArray(release.docUrls),
        audience: normalizeStringArray(release.audience),
        status: release.status,
        relatedIds: normalizeStringArray(release.relatedIds),
        howToSteps: normalizeStringArray(release.howToSteps),
        howToPrerequisites: normalizeStringArray(release.howToPrerequisites),
        sourceCandidateId: candidate.id,
      });
      await sql`
        update release_candidates
        set status = ${"approved"},
            approved_release_id = ${published.id},
            metadata = metadata || ${sql.json({ aiReview: reviewNote } as never)},
            updated_at = now()
        where id = ${candidate.id}
      `;
      await enqueueReleaseNotifications(published.id);
    }
  }

  return {
    runId,
    applied: approved + rejected + needsReview,
    approved,
    rejected,
    needsReview,
    skipped,
  };
}

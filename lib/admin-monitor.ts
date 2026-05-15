import { ensureDb } from "@/lib/db";

type CountRow = {
  key: string;
  count: number | string;
};

type HarnessRow = {
  id: string;
  provider: string;
  session_name: string | null;
  intent: string;
  status: string;
  ready: boolean | null;
  risk_level: string | null;
  context_path: string | null;
  outbox_path: string | null;
  checks: unknown;
  error: string | null;
  metadata: unknown;
  started_at: Date;
  finished_at: Date | null;
  updated_at: Date;
};

type HarnessEventRow = {
  id: string;
  run_id: string;
  provider: string | null;
  session_name: string | null;
  intent: string | null;
  phase: string;
  level: string;
  message: string | null;
  metadata: unknown;
  created_at: Date;
};

type AiReviewRunRow = {
  id: string;
  provider: string;
  model: string | null;
  status: string;
  exit_code: number | null;
  error: string | null;
  metadata: unknown;
  started_at: Date;
  finished_at: Date | null;
};

type SourceFailureRow = {
  id: string;
  source_id: string;
  source_label: string;
  entity_id: string;
  source_type: string;
  status: string;
  status_code: number | null;
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
};

type RecentCandidateRow = {
  id: string;
  entity_id: string;
  source_label: string;
  raw_title: string;
  status: string;
  created_at: Date;
};

type RecentReleaseRow = {
  id: string;
  entity_id: string;
  title: string;
  date: string;
  published_at: Date;
};

type DuplicateRejectionRow = {
  raw_title: string;
  source_label: string;
  count: number | string;
  last_seen_at: Date;
  reason: string | null;
};

type SourceFailureSummaryRow = {
  source_id: string;
  source_label: string;
  entity_id: string;
  status_code: number | null;
  error: string | null;
  count: number | string;
  last_failed_at: Date;
};

type SourceLagRow = {
  id: string;
  entity_id: string;
  label: string;
  source_type: string;
  next_fetch_at: Date;
  last_scheduled_at: Date | null;
};

export type AdminMonitorData = Awaited<ReturnType<typeof getAdminMonitorData>>;

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function normalizeJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return { raw: value };
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function durationMs(startedAt: Date, finishedAt: Date | null): number | null {
  if (!finishedAt) return null;
  return finishedAt.getTime() - startedAt.getTime();
}

function counts(rows: CountRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.key, toNumber(row.count)]));
}

function summarizeHarness(row: HarnessRow) {
  const metadata = normalizeJson(row.metadata);
  const checks = Array.isArray(row.checks) ? row.checks : [];
  return {
    id: row.id,
    provider: row.provider,
    sessionName: row.session_name,
    intent: row.intent,
    status: row.status,
    ready: row.ready,
    riskLevel: row.risk_level,
    contextPath: row.context_path,
    outboxPath: row.outbox_path,
    checks,
    error: row.error,
    metadata,
    startedAt: row.started_at.toISOString(),
    finishedAt: iso(row.finished_at),
    updatedAt: row.updated_at.toISOString(),
    durationMs: durationMs(row.started_at, row.finished_at),
  };
}

export async function getAdminMonitorData() {
  const sql = await ensureDb();
  if (!sql) {
    return null;
  }

  const [
    harnessRuns,
    aiRuns,
    harnessStatusRows,
    harnessEvents,
    candidateStatusRows,
    jobStatusRows,
    sourceTypeRows,
    sourceFailures,
    recentCandidates,
    recentReleases,
	    sourceLag,
	    pendingCandidateRows,
	    published24Rows,
	    events24Rows,
	    candidateOutcomeRows,
	    duplicateRejections,
	    sourceFailureSummary,
	  ] = await Promise.all([
    sql<HarnessRow[]>`
      select id,
             provider,
             session_name,
             intent,
             status,
             ready,
             risk_level,
             context_path,
             outbox_path,
             checks,
             error,
             metadata,
             started_at,
             finished_at,
             updated_at
      from ai_harness_runs
      order by started_at desc
      limit 20
    `,
    sql<AiReviewRunRow[]>`
      select id,
             provider,
             model,
             status,
             exit_code,
             error,
             metadata,
             started_at,
             finished_at
      from ai_review_runs
      order by started_at desc
      limit 12
    `,
    sql<CountRow[]>`
      select status as key, count(*)::int as count
      from ai_harness_runs
      where started_at > now() - interval '24 hours'
      group by status
    `,
    sql<HarnessEventRow[]>`
      select id,
             run_id,
             provider,
             session_name,
             intent,
             phase,
             level,
             message,
             metadata,
             created_at
      from ai_harness_events
      order by created_at desc
      limit 60
    `,
    sql<CountRow[]>`
      select status as key, count(*)::int as count
      from release_candidates
      group by status
    `,
    sql<CountRow[]>`
      select status as key, count(*)::int as count
      from fetch_jobs
      group by status
    `,
    sql<CountRow[]>`
      select source_type as key, count(*)::int as count
      from release_sources
      where enabled = true
      group by source_type
    `,
	    sql<SourceFailureRow[]>`
	      select r.id,
	             r.source_id,
	             s.label as source_label,
             s.entity_id,
             s.source_type,
             r.status,
             r.status_code,
             r.error,
             r.started_at,
             r.finished_at
	      from source_fetch_runs r
	      join release_sources s on s.id = r.source_id
	      where r.status = 'failed'
	      order by r.started_at desc
	      limit 12
	    `,
    sql<RecentCandidateRow[]>`
      select id,
             entity_id,
             source_label,
             raw_title,
             status,
             created_at
      from release_candidates
      order by created_at desc
      limit 10
    `,
    sql<RecentReleaseRow[]>`
      select id,
             entity_id,
             title,
             date,
             published_at
      from published_releases
      order by published_at desc
      limit 10
    `,
    sql<SourceLagRow[]>`
      select id,
             entity_id,
             label,
             source_type,
             next_fetch_at,
             last_scheduled_at
      from release_sources
      where enabled = true
        and next_fetch_at < now() - interval '15 minutes'
      order by next_fetch_at asc
      limit 10
    `,
    sql<{ count: number | string }[]>`
      select count(*)::int as count
      from release_candidates
      where status = 'pending'
    `,
    sql<{ count: number | string }[]>`
      select count(*)::int as count
      from published_releases
      where published_at > now() - interval '24 hours'
    `,
	    sql<{ count: number | string }[]>`
	      select count(*)::int as count
	      from release_events
	      where created_at > now() - interval '24 hours'
	    `,
	    sql<CountRow[]>`
	      select
	        case
	          when status = 'approved' then 'approved'
	          when status = 'pending' then 'pending'
	          when status = 'rejected' and metadata ? 'autoReview' then 'auto_rejected'
	          when status = 'rejected' and lower(coalesce(rejection_reason, '')) like '%duplicate%' then 'duplicate_rejected'
	          when status = 'rejected' then 'rejected_other'
	          else status
	        end as key,
	        count(*)::int as count
	      from release_candidates
	      where created_at > now() - interval '24 hours'
	         or updated_at > now() - interval '24 hours'
	      group by 1
	    `,
	    sql<DuplicateRejectionRow[]>`
	      select raw_title,
	             source_label,
	             count(*)::int as count,
	             max(updated_at) as last_seen_at,
	             max(rejection_reason) as reason
	      from release_candidates
	      where status = 'rejected'
	        and updated_at > now() - interval '24 hours'
	        and (
	          lower(coalesce(rejection_reason, '')) like '%duplicate%'
	          or metadata ? 'autoReview'
	        )
	      group by raw_title, source_label
	      order by count(*) desc, max(updated_at) desc
	      limit 8
	    `,
	    sql<SourceFailureSummaryRow[]>`
	      select r.source_id,
	             s.label as source_label,
	             s.entity_id,
	             r.status_code,
	             r.error,
	             count(*)::int as count,
	             max(r.started_at) as last_failed_at
	      from source_fetch_runs r
	      join release_sources s on s.id = r.source_id
	      where r.status = 'failed'
	        and r.started_at > now() - interval '6 hours'
	      group by r.source_id, s.label, s.entity_id, r.status_code, r.error
	      order by count(*) desc, max(r.started_at) desc
	      limit 8
	    `,
	  ]);

  const latestHarness = harnessRuns[0] ? summarizeHarness(harnessRuns[0]) : null;
  const lastStartedAt = latestHarness?.startedAt ? new Date(latestHarness.startedAt) : null;
  const minutesSinceLastRun = lastStartedAt ? Math.round((Date.now() - lastStartedAt.getTime()) / 60000) : null;
  const agentHealth =
    !latestHarness ? "unknown" :
    latestHarness.status === "published" || latestHarness.status === "deployed" || latestHarness.status === "dry_run" ? "healthy" :
    latestHarness.status === "injected" || latestHarness.status === "ready" ? "working" :
    latestHarness.status === "failed" ? "degraded" :
    "attention";

  return {
    generatedAt: new Date().toISOString(),
    headline: {
      agentHealth,
      latestHarnessStatus: latestHarness?.status ?? "none",
      latestHarnessProvider: latestHarness?.provider ?? null,
      latestHarnessIntent: latestHarness?.intent ?? null,
      minutesSinceLastRun,
      pendingCandidates: toNumber(pendingCandidateRows[0]?.count),
      published24h: toNumber(published24Rows[0]?.count),
	      sourceEvents24h: toNumber(events24Rows[0]?.count),
	      duplicateRejected24h: toNumber(candidateOutcomeRows.find((row) => row.key === "duplicate_rejected")?.count) + toNumber(candidateOutcomeRows.find((row) => row.key === "auto_rejected")?.count),
	      sourceFailures6h: sourceFailureSummary.reduce((sum, row) => sum + toNumber(row.count), 0),
	    },
	    counts: {
	      harnessByStatus24h: counts(harnessStatusRows),
	      candidatesByStatus: counts(candidateStatusRows),
	      candidateOutcomes24h: counts(candidateOutcomeRows),
	      jobsByStatus: counts(jobStatusRows),
	      sourcesByType: counts(sourceTypeRows),
	    },
    harnessRuns: harnessRuns.map(summarizeHarness),
    harnessEvents: harnessEvents.map((row) => ({
      id: row.id,
      runId: row.run_id,
      provider: row.provider,
      sessionName: row.session_name,
      intent: row.intent,
      phase: row.phase,
      level: row.level,
      message: row.message,
      metadata: normalizeJson(row.metadata),
      createdAt: row.created_at.toISOString(),
    })),
    aiReviewRuns: aiRuns.map((row) => ({
      id: row.id,
      provider: row.provider,
      model: row.model,
      status: row.status,
      exitCode: row.exit_code,
      error: row.error,
      metadata: normalizeJson(row.metadata),
      startedAt: row.started_at.toISOString(),
      finishedAt: iso(row.finished_at),
      durationMs: durationMs(row.started_at, row.finished_at),
    })),
    sourceFailures: sourceFailures.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      label: row.source_label,
      entityId: row.entity_id,
      sourceType: row.source_type,
      status: row.status,
      statusCode: row.status_code,
      error: row.error,
      startedAt: row.started_at.toISOString(),
      finishedAt: iso(row.finished_at),
    })),
    recentCandidates: recentCandidates.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      sourceLabel: row.source_label,
      title: row.raw_title,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    })),
	    recentReleases: recentReleases.map((row) => ({
	      id: row.id,
	      entityId: row.entity_id,
	      title: row.title,
	      date: row.date,
	      publishedAt: row.published_at.toISOString(),
	    })),
	    duplicateRejections: duplicateRejections.map((row) => ({
	      title: row.raw_title,
	      sourceLabel: row.source_label,
	      count: toNumber(row.count),
	      lastSeenAt: row.last_seen_at.toISOString(),
	      reason: row.reason,
	    })),
	    sourceFailureSummary: sourceFailureSummary.map((row) => ({
	      sourceId: row.source_id,
	      label: row.source_label,
	      entityId: row.entity_id,
	      statusCode: row.status_code,
	      error: row.error,
	      count: toNumber(row.count),
	      lastFailedAt: row.last_failed_at.toISOString(),
	    })),
	    sourceLag: sourceLag.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      label: row.label,
      sourceType: row.source_type,
      nextFetchAt: row.next_fetch_at.toISOString(),
      lastScheduledAt: iso(row.last_scheduled_at),
    })),
  };
}

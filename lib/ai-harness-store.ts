import { ensureDb } from "@/lib/db";
import { randomUUID } from "node:crypto";

export type AiHarnessRunInput = {
  id: string;
  provider?: string;
  sessionName?: string | null;
  intent: string;
  status: string;
  ready?: boolean | null;
  riskLevel?: string | null;
  contextPath?: string | null;
  outboxPath?: string | null;
  checks?: unknown[];
  error?: string | null;
  metadata?: Record<string, unknown>;
  finished?: boolean;
};

export type AiHarnessEventInput = {
  id?: string;
  runId: string;
  provider?: string | null;
  sessionName?: string | null;
  intent?: string | null;
  phase: string;
  level?: "debug" | "info" | "warn" | "error";
  message?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAiHarnessRun(input: AiHarnessRunInput): Promise<{ id: string }> {
  if (!input.id?.trim()) {
    throw new Error("missing_harness_run_id");
  }
  if (!input.intent?.trim()) {
    throw new Error("missing_harness_intent");
  }
  if (!input.status?.trim()) {
    throw new Error("missing_harness_status");
  }

  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }

  await sql`
    insert into ai_harness_runs (
      id,
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
    )
    values (
      ${input.id},
      ${input.provider || "unknown"},
      ${input.sessionName ?? null},
      ${input.intent},
      ${input.status},
      ${input.ready ?? null},
      ${input.riskLevel ?? null},
      ${input.contextPath ?? null},
      ${input.outboxPath ?? null},
      ${sql.json((input.checks ?? []) as never)},
      ${input.error ?? null},
      ${sql.json((input.metadata ?? {}) as never)},
      now(),
      ${input.finished ? sql`now()` : null},
      now()
    )
    on conflict (id) do update
    set provider = excluded.provider,
        session_name = excluded.session_name,
        intent = excluded.intent,
        status = excluded.status,
        ready = excluded.ready,
        risk_level = excluded.risk_level,
        context_path = excluded.context_path,
        outbox_path = excluded.outbox_path,
        checks = excluded.checks,
        error = excluded.error,
        metadata = ai_harness_runs.metadata || excluded.metadata,
        finished_at = case when ${input.finished === true} then now() else ai_harness_runs.finished_at end,
        updated_at = now()
  `;

  return { id: input.id };
}

export async function recordAiHarnessEvent(input: AiHarnessEventInput): Promise<{ id: string }> {
  if (!input.runId?.trim()) {
    throw new Error("missing_harness_event_run_id");
  }
  if (!input.phase?.trim()) {
    throw new Error("missing_harness_event_phase");
  }

  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }

  const id = input.id?.trim() || randomUUID();
  await sql`
    insert into ai_harness_events (
      id,
      run_id,
      provider,
      session_name,
      intent,
      phase,
      level,
      message,
      metadata,
      created_at
    )
    values (
      ${id},
      ${input.runId},
      ${input.provider ?? null},
      ${input.sessionName ?? null},
      ${input.intent ?? null},
      ${input.phase},
      ${input.level ?? "info"},
      ${input.message ?? null},
      ${sql.json((input.metadata ?? {}) as never)},
      now()
    )
  `;

  return { id };
}

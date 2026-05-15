#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  commandExists,
  ensureProviderSession,
  loadEnvFile,
  restartProviderSessionWithPrompt,
} from "./ai-session-send.mjs";

const root = process.env.RELEASELOG_ROOT || "/root/releaselog";
const envFile = process.env.RELEASELOG_ENV_FILE || `${root}/.env.docker`;
loadEnvFile(envFile);

const baseUrl = (process.env.AI_REVIEW_BASE_URL || process.env.RELEASELOG_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const publicUrl = (process.env.AI_HARNESS_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://releaselog.site").replace(/\/$/, "");
const harnessRoot = process.env.AI_HARNESS_DIR || join(root, "var/ai-harness");
const contextDir = join(harnessRoot, "context");
const outboxDir = join(harnessRoot, "outbox");
const stateDir = join(harnessRoot, "state");
const activeRunPath = join(stateDir, "active-run.json");
const limit = Number.parseInt(process.env.AI_HARNESS_BATCH_LIMIT || process.env.AI_REVIEW_BATCH_LIMIT || "8", 10);
const dryRun = process.argv.includes("--dry-run") || process.env.AI_HARNESS_DRY_RUN === "1" || process.env.AI_REVIEW_DRY_RUN === "1";
const rawIntentArg = process.argv.find((arg) => arg.startsWith("--intent="))?.slice("--intent=".length);
const rawIntent = rawIntentArg || process.env.AI_HARNESS_INTENT || "auto";
const waitTimeoutMs = Number.parseInt(process.env.AI_HARNESS_WAIT_TIMEOUT_MS || "2700000", 10);
const pollMs = Number.parseInt(process.env.AI_HARNESS_POLL_MS || "5000", 10);
const busyTimeoutMs = Number.parseInt(process.env.AI_HARNESS_BUSY_TIMEOUT_MS || "3300000", 10);
const goalPrefix = process.env.AI_HARNESS_GOAL_PREFIX || "/goal";
const skipNoCandidateRecord = process.env.AI_HARNESS_SKIP_NO_CANDIDATE_RECORD === "1";

function ensureDirs() {
  for (const path of [contextDir, outboxDir, stateDir]) {
    mkdirSync(path, { recursive: true });
  }
}

function truncate(value, max = 6000) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]` : text;
}

function capture(command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    timeout: options.timeout ?? 30000,
    maxBuffer: options.maxBuffer ?? 5 * 1024 * 1024,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  return {
    command: [command, ...args].join(" "),
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    stdout: truncate(result.stdout, options.max ?? 6000),
    stderr: truncate(result.stderr, options.max ?? 3000),
  };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { status: response.status, ok: response.ok, text: truncate(text, 2000) };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`invalid_json_response:${response.status}:${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`http_${response.status}:${JSON.stringify(json)}`);
  }
  return json;
}

async function recordHarnessRun(input) {
  try {
    await fetchJson(`${baseUrl}/api/cron/ai-harness`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (error) {
    console.warn(`ai-harness: failed to record run: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function recordHarnessEvent({ runId, provider, sessionName, intent, phase, level = "info", message, metadata = {} }) {
  try {
    await fetchJson(`${baseUrl}/api/cron/ai-harness`, {
      method: "POST",
      body: JSON.stringify({
        type: "event",
        runId,
        provider,
        sessionName,
        intent,
        phase,
        level,
        message,
        metadata,
      }),
    });
  } catch (error) {
    console.warn(`ai-harness: failed to record event ${phase}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listCandidates() {
  const response = await fetchJson(`${baseUrl}/api/cron/ai-review?limit=${Number.isFinite(limit) ? limit : 8}`);
  return response.candidates ?? [];
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJsonFile(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function clearActiveRun() {
  try {
    unlinkSync(activeRunPath);
  } catch {
    // Nothing to clear.
  }
}

function currentActiveRun() {
  if (!existsSync(activeRunPath)) return null;
  try {
    return readJsonFile(activeRunPath);
  } catch {
    clearActiveRun();
    return null;
  }
}

function activeRunIsBusy(active) {
  if (!active?.runId || !active?.outboxPath || !active?.deadlineAt) return false;
  if (existsSync(active.outboxPath)) return false;
  return Date.now() < Date.parse(active.deadlineAt);
}

async function collectContext({ runId, intent, candidates, outboxPath, provider }) {
  const localHealth = await fetchText(`${baseUrl}/`).catch((error) => ({ status: 0, ok: false, text: String(error) }));
  const remoteHealth = await fetchText(`${publicUrl}/`).catch((error) => ({ status: 0, ok: false, text: String(error) }));
  const commands = [
    capture("docker", ["compose", "--env-file", ".env.docker", "-f", "compose.yaml", "-f", "compose.prod.yaml", "-f", "compose.workers.yaml", "ps"]),
    capture("systemctl", ["is-active", "releaselog-ai-review.timer"]),
    capture("systemctl", ["is-enabled", "releaselog-ai-review.timer"]),
    capture("systemctl", ["list-timers", "--all", "releaselog-ai-review*", "--no-pager"]),
    capture("git", ["status", "--short"]),
  ];

  return `# ReleaseLog AI Harness Context

Run ID: ${runId}
Intent: ${intent}
Provider: ${provider}
Generated at: ${new Date().toISOString()}
Repo root: ${root}
Outbox path: ${outboxPath}
Dry run: ${dryRun}

## Required Protocol

- You are running in a persistent interactive CLI session.
- Treat the first line ${goalPrefix} as the task goal marker, even if the CLI does not implement slash commands.
- Do not publish releases directly.
- Do not deploy Docker/systemd changes directly.
- Write exactly one JSON object to the outbox path when you believe the task is ready or blocked.
- Harness will validate the outbox, run gates, and execute publish/deploy.

## Environment Model

- Development environment: repo at ${root}; source changes happen in this working tree.
- Runtime environment: Docker Compose app/db/workers using .env.docker; public traffic reaches http://127.0.0.1:3000 through cloudflared.
- Data environment: release candidates, releases, queues, and harness logs live in Postgres behind the app API.
- Release publish path: POST ${baseUrl}/api/cron/ai-review with structured decisions.
- Deploy path: validate/build, Docker Compose rebuild, local/public HTTP health, worker status, timer status.

## Ready Definition

- You understand which changes affect dev only and which affect runtime.
- You have enough evidence to mark the run ready.
- riskLevel is low or medium.
- For release_publish, decisions are structured and high-confidence approvals use confidence >= 0.85.
- For code_deploy, you have made only necessary changes and expect the fixed harness gates to pass.

## Outbox Schema

Write this JSON file to ${outboxPath}:

\`\`\`json
{
  "runId": "${runId}",
  "intent": "${intent}",
  "provider": "${provider}",
  "ready": true,
  "summary": "string",
  "environmentUnderstanding": {
    "dev": "string",
    "runtime": "string",
    "data": "string"
  },
  "decisions": [],
  "proposedCommands": [],
  "riskLevel": "low",
  "checksExpected": ["build", "health", "queue", "public_http"]
}
\`\`\`

Use ready=false when the correct result is blocked or no-op.

## Candidates

\`\`\`json
${JSON.stringify(candidates, null, 2)}
\`\`\`

## Runtime Snapshot

Local health: ${JSON.stringify(localHealth)}
Public health: ${JSON.stringify(remoteHealth)}

\`\`\`json
${JSON.stringify(commands, null, 2)}
\`\`\`
`;
}

function buildGoalPrompt(contextPath, context) {
  const outboxMatch = context.match(/Outbox path: (.+)/);
  const outboxPath = outboxMatch?.[1]?.trim() || "the outbox path named in the context file";
  return `Goal marker ${goalPrefix}: ReleaseLog autonomous harness task. Read ${contextPath}, follow the Required Protocol, and write exactly one JSON object to ${outboxPath}. Do not publish releases or deploy Docker/systemd directly; the harness will validate ready state and run gates.`;
}

function chooseIntent(candidates) {
  if (rawIntent === "release_publish" || rawIntent === "code_deploy") return rawIntent;
  return candidates.length > 0 ? "release_publish" : "code_deploy";
}

async function chooseProvider() {
  const primary = (process.env.AI_HARNESS_PRIMARY_CLI || process.env.AI_REVIEW_CLI || "codex").trim().toLowerCase();
  const fallback = (process.env.AI_HARNESS_FALLBACK_CLI || (primary === "codex" ? "claude" : "codex")).trim().toLowerCase();
  for (const provider of [primary, fallback]) {
    if (provider !== "codex" && provider !== "claude") continue;
    try {
      return await ensureProviderSession(provider, { root });
    } catch (error) {
      console.warn(`ai-harness: ${provider} unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error("no_ai_cli_session_available");
}

async function waitForOutbox(outboxPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(outboxPath)) {
      return readJsonFile(outboxPath);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`outbox_timeout:${outboxPath}`);
}

function validateOutbox(outbox, { runId, intent, candidates }) {
  if (!outbox || typeof outbox !== "object") throw new Error("outbox_not_object");
  if (outbox.runId !== runId) throw new Error("outbox_run_id_mismatch");
  if (outbox.intent !== intent) throw new Error("outbox_intent_mismatch");
  if (!outbox.environmentUnderstanding?.dev || !outbox.environmentUnderstanding?.runtime || !outbox.environmentUnderstanding?.data) {
    throw new Error("outbox_missing_environment_understanding");
  }
  const risk = String(outbox.riskLevel || "").toLowerCase();
  if (!["low", "medium", "high"].includes(risk)) throw new Error("outbox_invalid_risk_level");
  if (risk === "high") throw new Error("outbox_high_risk_blocked");

  if (intent === "release_publish") {
    const validCandidateIds = new Set(candidates.map((candidate) => candidate.id));
    const decisions = Array.isArray(outbox.decisions) ? outbox.decisions : [];
    for (const decision of decisions) {
      if (!validCandidateIds.has(decision.candidateId)) throw new Error(`decision_unknown_candidate:${decision.candidateId}`);
      if (!["approve", "reject", "needs_review"].includes(decision.action)) throw new Error(`decision_invalid_action:${decision.candidateId}`);
      if (decision.action === "approve" && typeof decision.confidence !== "number") {
        throw new Error(`decision_missing_confidence:${decision.candidateId}`);
      }
    }
  }
}

async function publishReleaseDecisions({ provider, outbox }) {
  const decisions = Array.isArray(outbox.decisions) ? outbox.decisions : [];
  return fetchJson(`${baseUrl}/api/cron/ai-review`, {
    method: "POST",
    body: JSON.stringify({
      provider,
      model: outbox.model,
      command: "ai-harness",
      exitCode: 0,
      output: JSON.stringify({ summary: outbox.summary, riskLevel: outbox.riskLevel }),
      dryRun,
      decisions,
    }),
  });
}

function decisionCounts(outbox) {
  const result = { approve: 0, reject: 0, needs_review: 0 };
  for (const decision of Array.isArray(outbox?.decisions) ? outbox.decisions : []) {
    if (decision?.action === "approve") result.approve += 1;
    if (decision?.action === "reject") result.reject += 1;
    if (decision?.action === "needs_review") result.needs_review += 1;
  }
  return result;
}

function checkResult(name, result, ok) {
  return { name, ok, ...result };
}

async function executeDeployGates({ runId, provider, sessionName, intent }) {
  const checks = [];
  const commands = [
    ["validate", "npm", ["run", "validate"], 120000],
    ["build", "npm", ["run", "build"], 900000],
  ];
  if (!dryRun) {
    commands.push([
      "docker_deploy",
      "docker",
      ["compose", "--env-file", ".env.docker", "-f", "compose.yaml", "-f", "compose.prod.yaml", "-f", "compose.workers.yaml", "up", "-d", "--build", "--remove-orphans"],
      1200000,
    ]);
  }
  for (const [name, command, args, timeout] of commands) {
    await recordHarnessEvent({ runId, provider, sessionName, intent, phase: "deploy_gate_started", message: `Running ${name}`, metadata: { name, command, args } });
    const result = capture(command, args, { timeout, max: 10000 });
    const check = checkResult(name, result, result.exitCode === 0);
    checks.push(check);
    await recordHarnessEvent({
      runId,
      provider,
      sessionName,
      intent,
      phase: check.ok ? "deploy_gate_passed" : "deploy_gate_failed",
      level: check.ok ? "info" : "error",
      message: `${name} ${check.ok ? "passed" : "failed"}`,
      metadata: { check },
    });
    if (!check.ok) {
      const error = new Error(`deploy_gate_failed:${name}`);
      error.checks = checks;
      throw error;
    }
  }

  const local = await fetchText(`${baseUrl}/`);
  checks.push({ name: "local_http", ok: local.ok, ...local });
  await recordHarnessEvent({ runId, provider, sessionName, intent, phase: local.ok ? "deploy_gate_passed" : "deploy_gate_failed", level: local.ok ? "info" : "error", message: "Local HTTP health", metadata: { check: checks.at(-1) } });
  if (!local.ok) {
    const error = new Error("deploy_gate_failed:local_http");
    error.checks = checks;
    throw error;
  }

  const remote = await fetchText(`${publicUrl}/`);
  checks.push({ name: "public_http", ok: remote.ok, ...remote });
  await recordHarnessEvent({ runId, provider, sessionName, intent, phase: remote.ok ? "deploy_gate_passed" : "deploy_gate_failed", level: remote.ok ? "info" : "error", message: "Public HTTP health", metadata: { check: checks.at(-1) } });
  if (!remote.ok) {
    const error = new Error("deploy_gate_failed:public_http");
    error.checks = checks;
    throw error;
  }

  const ps = capture("docker", ["compose", "--env-file", ".env.docker", "-f", "compose.yaml", "-f", "compose.prod.yaml", "-f", "compose.workers.yaml", "ps"]);
  const workerNames = ["source-scheduler-worker", "collector-worker", "send-worker", "weekly-digest-worker"];
  const workersOk = ps.exitCode === 0 && workerNames.every((name) => ps.stdout.includes(name) && ps.stdout.includes("Up"));
  checks.push(checkResult("workers_up", ps, workersOk));
  await recordHarnessEvent({ runId, provider, sessionName, intent, phase: workersOk ? "deploy_gate_passed" : "deploy_gate_failed", level: workersOk ? "info" : "error", message: "Worker containers health", metadata: { check: checks.at(-1) } });
  if (!workersOk) {
    const error = new Error("deploy_gate_failed:workers_up");
    error.checks = checks;
    throw error;
  }

  const active = capture("systemctl", ["is-active", "releaselog-ai-review.timer"]);
  checks.push(checkResult("ai_timer_active", active, active.exitCode === 0 && active.stdout.trim() === "active"));
  const enabled = capture("systemctl", ["is-enabled", "releaselog-ai-review.timer"]);
  checks.push(checkResult("ai_timer_enabled", enabled, enabled.exitCode === 0 && enabled.stdout.trim() === "enabled"));
  await recordHarnessEvent({
    runId,
    provider,
    sessionName,
    intent,
    phase: checks.at(-2)?.ok && checks.at(-1)?.ok ? "deploy_gate_passed" : "deploy_gate_failed",
    level: checks.at(-2)?.ok && checks.at(-1)?.ok ? "info" : "error",
    message: "AI timer health",
    metadata: { active: checks.at(-2), enabled: checks.at(-1) },
  });
  if (!checks.at(-2).ok || !checks.at(-1).ok) {
    const error = new Error("deploy_gate_failed:ai_timer");
    error.checks = checks;
    throw error;
  }

  return checks;
}

async function main() {
  ensureDirs();
  if (!process.env.CRON_SECRET?.trim()) {
    throw new Error(`CRON_SECRET missing from ${envFile}`);
  }
  if (!commandExists("tmux")) {
    throw new Error("tmux_not_found");
  }

  const candidates = await listCandidates();
  const intent = chooseIntent(candidates);
  const runId = randomUUID();
  const contextPath = join(contextDir, `${runId}.md`);
  const outboxPath = join(outboxDir, `${runId}.json`);
  const active = currentActiveRun();
  if (activeRunIsBusy(active)) {
    await recordHarnessRun({
      id: runId,
      provider: active.provider || "unknown",
      sessionName: active.sessionName ?? null,
      intent,
      status: "busy",
      ready: false,
      outboxPath,
      error: `active_run:${active.runId}`,
      metadata: { activeRun: active },
      finished: true,
    });
    await recordHarnessEvent({
      runId,
      provider: active.provider || "unknown",
      sessionName: active.sessionName ?? null,
      intent,
      phase: "busy",
      level: "warn",
      message: `Skipped because run ${active.runId} is still active`,
      metadata: { activeRun: active },
    });
    console.log(JSON.stringify({ ok: true, status: "busy", activeRun: active.runId }));
    return;
  }
  clearActiveRun();

  if (intent === "release_publish" && candidates.length === 0) {
    if (skipNoCandidateRecord) {
      console.log(JSON.stringify({ ok: true, status: "no_pending_candidates", recorded: false }));
      return;
    }
    await recordHarnessRun({
      id: runId,
      provider: "harness",
      intent,
      status: "completed",
      ready: false,
      metadata: { reason: "no_pending_candidates", dryRun },
      finished: true,
    });
    await recordHarnessEvent({
      runId,
      provider: "harness",
      intent,
      phase: "no_candidates",
      message: "No pending release candidates",
      metadata: { dryRun },
    });
    console.log(JSON.stringify({ ok: true, status: "no_pending_candidates" }));
    return;
  }

  const session = await chooseProvider();
  await recordHarnessRun({
    id: runId,
    provider: session.provider,
    sessionName: session.sessionName,
    intent,
    status: "queued",
    ready: null,
    contextPath,
    outboxPath,
    metadata: { dryRun, candidateCount: candidates.length },
  });
  await recordHarnessEvent({
    runId,
    provider: session.provider,
    sessionName: session.sessionName,
    intent,
    phase: "queued",
    message: "Harness run queued",
    metadata: { dryRun, candidateCount: candidates.length },
  });

  const context = await collectContext({ runId, intent, candidates, outboxPath, provider: session.provider });
  writeFileSync(contextPath, context, "utf8");
  await recordHarnessEvent({
    runId,
    provider: session.provider,
    sessionName: session.sessionName,
    intent,
    phase: "context_written",
    message: "Dev/runtime context written for agent",
    metadata: { contextPath, outboxPath, contextBytes: context.length },
  });
  const prompt = buildGoalPrompt(contextPath, context);
  const goalSession = await restartProviderSessionWithPrompt(session.provider, prompt, { root });
  const deadlineAt = new Date(Date.now() + Math.min(waitTimeoutMs, busyTimeoutMs)).toISOString();
  writeJsonFile(activeRunPath, { runId, provider: goalSession.provider, sessionName: goalSession.sessionName, intent, outboxPath, injectedAt: new Date().toISOString(), deadlineAt });
  await recordHarnessRun({
    id: runId,
    provider: goalSession.provider,
    sessionName: goalSession.sessionName,
    intent,
    status: "injected",
    ready: null,
    contextPath,
    outboxPath,
    metadata: { deadlineAt },
  });
  await recordHarnessEvent({
    runId,
    provider: goalSession.provider,
    sessionName: goalSession.sessionName,
    intent,
    phase: "goal_injected",
    message: "Agent session started with harness goal",
    metadata: { contextPath, outboxPath, deadlineAt, prompt },
  });

  if (process.env.AI_HARNESS_INJECT_ONLY === "1") {
    console.log(JSON.stringify({ ok: true, status: "injected", runId, outboxPath }));
    return;
  }

  let outbox;
  let checks = [];
  try {
    await recordHarnessEvent({
      runId,
      provider: goalSession.provider,
      sessionName: goalSession.sessionName,
      intent,
      phase: "waiting_for_outbox",
      message: "Waiting for agent ready outbox",
      metadata: { outboxPath, timeoutMs: waitTimeoutMs },
    });
    outbox = await waitForOutbox(outboxPath, waitTimeoutMs);
    await recordHarnessEvent({
      runId,
      provider: goalSession.provider,
      sessionName: goalSession.sessionName,
      intent,
      phase: "outbox_received",
      message: outbox.summary || "Agent wrote outbox",
      metadata: { outbox, decisionCounts: decisionCounts(outbox) },
    });
    validateOutbox(outbox, { runId, intent, candidates });
    await recordHarnessEvent({
      runId,
      provider: goalSession.provider,
      sessionName: goalSession.sessionName,
      intent,
      phase: "outbox_validated",
      message: "Outbox passed harness validation",
      metadata: { riskLevel: outbox.riskLevel, ready: outbox.ready, decisionCounts: decisionCounts(outbox) },
    });
    await recordHarnessRun({
      id: runId,
      provider: session.provider,
      sessionName: session.sessionName,
      intent,
      status: outbox.ready === true ? "ready" : "blocked",
      ready: outbox.ready === true,
      riskLevel: outbox.riskLevel ?? null,
      contextPath,
      outboxPath,
      metadata: { summary: outbox.summary, checksExpected: outbox.checksExpected ?? [] },
    });

    if (outbox.ready !== true) {
      clearActiveRun();
      await recordHarnessRun({
        id: runId,
        provider: session.provider,
        sessionName: session.sessionName,
        intent,
        status: "blocked",
        ready: false,
        riskLevel: outbox.riskLevel ?? null,
        contextPath,
        outboxPath,
        error: outbox.summary || "ready_false",
        metadata: { outbox, decisionCounts: decisionCounts(outbox) },
        finished: true,
      });
      await recordHarnessEvent({
        runId,
        provider: session.provider,
        sessionName: session.sessionName,
        intent,
        phase: "blocked",
        level: "warn",
        message: outbox.summary || "Agent returned ready=false",
        metadata: { outbox, decisionCounts: decisionCounts(outbox) },
      });
      console.log(JSON.stringify({ ok: true, status: "blocked", runId }));
      return;
    }

    if (intent === "release_publish") {
      await recordHarnessEvent({
        runId,
        provider: session.provider,
        sessionName: session.sessionName,
        intent,
        phase: "apply_started",
        message: "Applying AI review decisions through app API",
        metadata: { decisionCounts: decisionCounts(outbox), dryRun },
      });
      const apply = await publishReleaseDecisions({ provider: session.provider, outbox });
      checks = [{ name: "ai_review_apply", ok: true, response: apply }];
      await recordHarnessEvent({
        runId,
        provider: session.provider,
        sessionName: session.sessionName,
        intent,
        phase: "apply_completed",
        message: "AI review apply completed",
        metadata: { apply, dryRun },
      });
      await recordHarnessRun({
        id: runId,
        provider: session.provider,
        sessionName: session.sessionName,
        intent,
        status: dryRun ? "dry_run" : "published",
        ready: true,
        riskLevel: outbox.riskLevel,
        contextPath,
        outboxPath,
        checks,
        metadata: { apply, decisionCounts: decisionCounts(outbox) },
        finished: true,
      });
      await recordHarnessEvent({
        runId,
        provider: session.provider,
        sessionName: session.sessionName,
        intent,
        phase: dryRun ? "dry_run_completed" : "published",
        message: dryRun ? "Dry run completed" : "Harness published release decisions",
        metadata: { apply, decisionCounts: decisionCounts(outbox) },
      });
      clearActiveRun();
      console.log(JSON.stringify({ ok: true, status: dryRun ? "dry_run" : "published", runId, apply }));
      return;
    }

    checks = await executeDeployGates({ runId, provider: session.provider, sessionName: session.sessionName, intent });
    await recordHarnessRun({
      id: runId,
      provider: session.provider,
      sessionName: session.sessionName,
      intent,
      status: dryRun ? "dry_run" : "deployed",
      ready: true,
      riskLevel: outbox.riskLevel,
      contextPath,
      outboxPath,
      checks,
      metadata: { summary: outbox.summary, decisionCounts: decisionCounts(outbox) },
      finished: true,
    });
    await recordHarnessEvent({
      runId,
      provider: session.provider,
      sessionName: session.sessionName,
      intent,
      phase: dryRun ? "dry_run_completed" : "deployed",
      message: dryRun ? "Deploy dry run completed" : "Harness deploy gates completed",
      metadata: { checks },
    });
    clearActiveRun();
    console.log(JSON.stringify({ ok: true, status: dryRun ? "dry_run" : "deployed", runId }));
  } catch (error) {
    clearActiveRun();
    checks = error?.checks ?? checks;
    await recordHarnessRun({
      id: runId,
      provider: session.provider,
      sessionName: session.sessionName,
      intent,
      status: "failed",
      ready: false,
      riskLevel: outbox?.riskLevel ?? null,
      contextPath,
      outboxPath,
      checks,
      error: error instanceof Error ? error.message : String(error),
      metadata: { outbox: outbox ?? null, decisionCounts: decisionCounts(outbox) },
      finished: true,
    });
    await recordHarnessEvent({
      runId,
      provider: session.provider,
      sessionName: session.sessionName,
      intent,
      phase: "failed",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { checks, outbox: outbox ?? null, decisionCounts: decisionCounts(outbox) },
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(`ai-harness: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
});

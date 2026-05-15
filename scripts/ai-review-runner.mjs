#!/usr/bin/env node
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.env.RELEASELOG_ROOT || "/root/releaselog";
const envFile = process.env.RELEASELOG_ENV_FILE || `${root}/.env.docker`;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0;
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
    throw new Error(`invalid_json_response:${response.status}:${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`http_${response.status}:${JSON.stringify(json)}`);
  }
  return json;
}

function buildPrompt(candidates) {
  return `You are the autonomous ReleaseLog reviewer.

Review pending release candidates and decide whether each one is a real, user-facing release event.

Rules:
- Approve only high-confidence official product, API, model, library, or event updates.
- Reject generic page changes, navigation/content churn, marketing-only changes, duplicates, and inaccessible/low-signal items.
- Use needs_review when a candidate may matter but the evidence is incomplete.
- Return JSON only. Do not include markdown.
- For approve, provide a normalized release object with date, title, description, whatChanged, sourceUrl, importance, audience, status, tags, and docUrls when useful.
- Use confidence 0 to 1. The system only auto-publishes approvals with confidence >= 0.85.

Candidate JSON:
${JSON.stringify(candidates, null, 2)}

Required response shape:
{
  "decisions": [
    {
      "candidateId": "string",
      "action": "approve | reject | needs_review",
      "confidence": 0.0,
      "reason": "string",
      "release": {
        "entityId": "string",
        "date": "YYYY-MM-DD",
        "title": "string",
        "shortTitle": "string",
        "description": "string",
        "whatChanged": "string",
        "sourceUrl": "string",
        "importance": 1,
        "audience": ["developer"],
        "status": "stable",
        "tags": ["string"],
        "docUrls": []
      }
    }
  ]
}`;
}

function parsePossiblyWrappedJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.decisions)) return parsed;
      if (typeof parsed.result === "string") return parsePossiblyWrappedJson(parsed.result);
      if (parsed.result && typeof parsed.result === "object") return parsed.result;
      if (typeof parsed.output === "string") return parsePossiblyWrappedJson(parsed.output);
    }
    return parsed;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`ai_output_not_json:${trimmed.slice(0, 400)}`);
    return JSON.parse(match[0]);
  }
}

function runClaude(prompt) {
  const schema = JSON.stringify({
    type: "object",
    additionalProperties: false,
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          required: ["candidateId", "action", "confidence", "reason"],
          properties: {
            candidateId: { type: "string" },
            action: { type: "string", enum: ["approve", "reject", "needs_review"] },
            confidence: { type: "number" },
            reason: { type: "string" },
            release: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    required: ["decisions"],
  });
  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    schema,
    "--permission-mode",
    "dontAsk",
    "--max-budget-usd",
    process.env.AI_REVIEW_MAX_BUDGET_USD || "2",
  ];
  return spawnSync("claude", args, {
    cwd: root,
    encoding: "utf8",
    input: prompt,
    maxBuffer: 10 * 1024 * 1024,
    timeout: Number(process.env.AI_REVIEW_TIMEOUT_MS || 600000),
  });
}

function runCodex(prompt) {
  const outputFile = `/tmp/releaselog-ai-review-${process.pid}-${Date.now()}.json`;
  const args = [
    "exec",
    "-C",
    root,
    "-s",
    "read-only",
    "--skip-git-repo-check",
    "-o",
    outputFile,
    "-",
  ];
  const result = spawnSync("codex", args, {
    cwd: root,
    encoding: "utf8",
    input: prompt,
    maxBuffer: 10 * 1024 * 1024,
    timeout: Number(process.env.AI_REVIEW_TIMEOUT_MS || 600000),
  });
  if (existsSync(outputFile)) {
    const finalMessage = readFileSync(outputFile, "utf8");
    try {
      unlinkSync(outputFile);
    } catch {
      // Best-effort cleanup only.
    }
    return {
      ...result,
      stdout: finalMessage || result.stdout,
    };
  }
  return result;
}

function chooseProvider() {
  const preferred = (process.env.AI_REVIEW_CLI || "claude").trim().toLowerCase();
  if (preferred === "claude" && commandExists("claude")) return "claude";
  if (preferred === "codex" && commandExists("codex")) return "codex";
  if (commandExists("claude")) return "claude";
  if (commandExists("codex")) return "codex";
  throw new Error("no_real_ai_cli_found");
}

loadEnvFile(envFile);

if (!process.env.CRON_SECRET?.trim()) {
  throw new Error(`CRON_SECRET missing from ${envFile}`);
}

const baseUrl = (process.env.AI_REVIEW_BASE_URL || process.env.RELEASELOG_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const limit = Number.parseInt(process.env.AI_REVIEW_BATCH_LIMIT || "8", 10);
const dryRun = process.env.AI_REVIEW_DRY_RUN === "1";

const candidatesResponse = await fetchJson(`${baseUrl}/api/cron/ai-review?limit=${Number.isFinite(limit) ? limit : 8}`);
const candidates = candidatesResponse.candidates ?? [];
if (candidates.length === 0) {
  console.log("ai-review-runner: no pending candidates");
  process.exit(0);
}

const provider = chooseProvider();
const prompt = buildPrompt(candidates);
const result = provider === "claude" ? runClaude(prompt) : runCodex(prompt);
const stdout = `${result.stdout ?? ""}`.trim();
const stderr = `${result.stderr ?? ""}`.trim();
const output = [stdout, stderr].filter(Boolean).join("\n");

let decisions = [];
let parseError = null;
if (result.status === 0) {
  try {
    const parsed = parsePossiblyWrappedJson(stdout || output);
    decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
}

const applyResponse = await fetchJson(`${baseUrl}/api/cron/ai-review`, {
  method: "POST",
  body: JSON.stringify({
    provider,
    command: provider,
    exitCode: result.status,
    output,
    error: result.status === 0 ? parseError : output || `exit_${result.status}`,
    dryRun,
    decisions,
  }),
});

console.log(JSON.stringify({
  provider,
  candidates: candidates.length,
  decisions: decisions.length,
  dryRun,
  apply: applyResponse,
}));

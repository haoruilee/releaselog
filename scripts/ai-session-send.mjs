#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = process.env.RELEASELOG_ROOT || "/root/releaselog";
const envFile = process.env.RELEASELOG_ENV_FILE || `${root}/.env.docker`;

export function loadEnvFile(path = envFile) {
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

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout ?? 30000,
    maxBuffer: options.maxBuffer ?? 5 * 1024 * 1024,
    env: {
      ...process.env,
      TERM: process.env.TERM || "xterm-256color",
      ...(options.env ?? {}),
    },
  });
}

export function commandExists(command) {
  const result = run("sh", ["-lc", `command -v ${shellQuote(command)}`], { timeout: 5000 });
  return result.status === 0;
}

export function sessionExists(sessionName) {
  const result = run("tmux", ["has-session", "-t", sessionName], { timeout: 5000 });
  return result.status === 0;
}

export function providerConfig(provider, cwd = root) {
  const normalized = provider === "claude" ? "claude" : "codex";
  if (normalized === "claude") {
    const allowedTools = process.env.AI_HARNESS_CLAUDE_ALLOWED_TOOLS || "Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit";
    return {
      provider: "claude",
      command: "claude",
      sessionName: process.env.AI_HARNESS_CLAUDE_SESSION || "releaselog-ai-goal-claude",
      service: process.env.AI_HARNESS_CLAUDE_SERVICE || "releaselog-ai-goal-claude-session.service",
      launchCommand: `exec claude --permission-mode dontAsk --allowedTools ${shellQuote(allowedTools)} --add-dir ${shellQuote(cwd)}`,
    };
  }
  return {
    provider: "codex",
      command: "codex",
      sessionName: process.env.AI_HARNESS_CODEX_SESSION || process.env.AI_HARNESS_SESSION || "releaselog-ai-goal",
      service: process.env.AI_HARNESS_CODEX_SERVICE || "releaselog-ai-goal-session.service",
      launchCommand: `exec codex -C ${shellQuote(cwd)} --dangerously-bypass-approvals-and-sandbox --no-alt-screen`,
  };
}

export function providerPromptCommand(provider, prompt, cwd = root) {
  const normalized = provider === "claude" ? "claude" : "codex";
  const quotedPrompt = shellQuote(prompt);
  if (normalized === "claude") {
    const allowedTools = process.env.AI_HARNESS_CLAUDE_ALLOWED_TOOLS || "Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit";
    return `exec claude ${quotedPrompt} --permission-mode dontAsk --allowedTools ${shellQuote(allowedTools)} --add-dir ${shellQuote(cwd)}`;
  }
  return `exec codex -C ${shellQuote(cwd)} --dangerously-bypass-approvals-and-sandbox --no-alt-screen ${quotedPrompt}`;
}

function startSessionViaSystemd(service) {
  if (!commandExists("systemctl")) return false;
  const result = run("systemctl", ["start", service], { timeout: 30000 });
  return result.status === 0;
}

function startSessionDirect(config, cwd = root) {
  const result = run("tmux", ["new-session", "-d", "-s", config.sessionName, "-c", cwd, config.launchCommand], {
    timeout: 30000,
  });
  return result.status === 0;
}

export async function ensureProviderSession(provider, options = {}) {
  const cwd = options.root || root;
  const config = providerConfig(provider, cwd);
  if (!commandExists("tmux")) {
    throw new Error("tmux_not_found");
  }
  if (!commandExists(config.command)) {
    throw new Error(`${config.command}_not_found`);
  }
  if (sessionExists(config.sessionName)) {
    return config;
  }

  startSessionViaSystemd(config.service);
  if (!sessionExists(config.sessionName)) {
    startSessionDirect(config, cwd);
  }
  const deadline = Date.now() + (options.waitMs ?? 15000);
  while (Date.now() < deadline) {
    if (sessionExists(config.sessionName)) return config;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`session_not_ready:${config.sessionName}`);
}

export async function restartProviderSessionWithPrompt(provider, prompt, options = {}) {
  const cwd = options.root || root;
  const config = providerConfig(provider, cwd);
  if (!commandExists("tmux")) {
    throw new Error("tmux_not_found");
  }
  if (!commandExists(config.command)) {
    throw new Error(`${config.command}_not_found`);
  }
  run("tmux", ["kill-session", "-t", config.sessionName], { timeout: 10000 });
  const result = run("tmux", ["new-session", "-d", "-s", config.sessionName, "-c", cwd, providerPromptCommand(provider, prompt, cwd)], {
    timeout: 30000,
  });
  if (result.status !== 0) {
    throw new Error(`tmux_start_prompt_session_failed:${result.stderr || result.stdout}`);
  }
  const deadline = Date.now() + (options.waitMs ?? 15000);
  while (Date.now() < deadline) {
    if (sessionExists(config.sessionName)) return config;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`session_not_ready:${config.sessionName}`);
}

export function sendTextToSession(sessionName, text) {
  if (!sessionExists(sessionName)) {
    throw new Error(`tmux_session_missing:${sessionName}`);
  }
  if (text.length <= 3500 && !text.includes("\n")) {
    const literal = run("tmux", ["send-keys", "-t", sessionName, "-l", text], { timeout: 10000 });
    if (literal.status !== 0) {
      throw new Error(`tmux_send_literal_failed:${literal.stderr || literal.stdout}`);
    }
    const submit = run("tmux", ["send-keys", "-t", sessionName, "Enter"], { timeout: 10000 });
    if (submit.status !== 0) {
      throw new Error(`tmux_submit_failed:${submit.stderr || submit.stdout}`);
    }
    return;
  }
  const bufferName = `releaselog-ai-${randomUUID()}`;
  const payload = text.endsWith("\n") ? text : `${text}\n`;
  const load = run("tmux", ["load-buffer", "-b", bufferName, "-"], { input: payload, timeout: 10000 });
  if (load.status !== 0) {
    throw new Error(`tmux_load_buffer_failed:${load.stderr || load.stdout}`);
  }
  const paste = run("tmux", ["paste-buffer", "-b", bufferName, "-t", sessionName], { timeout: 10000 });
  if (paste.status !== 0) {
    throw new Error(`tmux_paste_failed:${paste.stderr || paste.stdout}`);
  }
  const enter = run("tmux", ["send-keys", "-t", sessionName, "Enter"], { timeout: 10000 });
  if (enter.status !== 0) {
    throw new Error(`tmux_enter_failed:${enter.stderr || enter.stdout}`);
  }
}

if (process.argv[1] && basename(fileURLToPath(import.meta.url)) === basename(process.argv[1])) {
  loadEnvFile();
  const provider = process.argv.includes("--provider=claude") ? "claude" : "codex";
  const text = readFileSync(0, "utf8");
  const config = await ensureProviderSession(provider, { root });
  sendTextToSession(config.sessionName, text);
  console.log(JSON.stringify({ ok: true, provider: config.provider, sessionName: config.sessionName }));
}

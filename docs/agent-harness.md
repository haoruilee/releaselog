# ReleaseLog Agent Harness 操作与实现说明

这份文档说明 ReleaseLog 现在的 autonomous agent harness 怎么运行、怎么排障、怎么观察，以及为什么这套机制可以让真实的 Codex CLI 或 Claude Code CLI 持续参与审阅和升级，但仍由系统控制发布边界。

一句话版本：这不是模型 API 的一次性调用，也不是 CLI callback。系统用 `tmux` 承载真实交互式 CLI，用 `/goal` 下发任务，用 run-specific outbox JSON 作为完成信号，再由 harness 验证 outbox、执行 gates、写数据库事件并完成发布。

如果只想理解 TTY、tmux、Codex CLI 和 Claude Code CLI 的启动差异，先读 [Codex 和 Claude Code 的 TTY / tmux 使用说明](ai-cli-tty-tmux.md)。

## 设计目标

ReleaseLog 的目标是持续从 Source Registry、Collector Workers 和 Queue 获得 release candidate，再让真实 AI coding agent 审阅这些候选、理解开发环境和运行环境，最后由系统决定是否发布或部署。

这套系统有几个硬约束：

- agent 可以读代码、看运行环境、执行审阅、提出结论。
- agent 不能直接发布 release，不能直接部署 Docker 或 systemd。
- agent 完成工作的正式信号只能是 outbox JSON。
- harness 必须验证 outbox 的 run id、intent、环境理解、风险级别和决策结构。
- release publish 和 code deploy 的最终副作用都由 harness 执行。
- 每个重要阶段都必须写入 `ai_harness_runs` 和 `ai_harness_events`，供管理员后台观察。

## 当前拓扑

生产上分成几层：

| 层 | 位置 | 作用 |
|---|---|---|
| Docker Compose | host | 运行 Next.js app、Postgres、collector/scheduler/send workers |
| Docker volumes | Docker | 保存 Postgres 等 mutable state |
| systemd timer | host | 每小时启动 autonomous harness |
| tmux session | host | 承载真实 Codex CLI 或 Claude Code CLI |
| harness runtime files | repo `var/ai-harness/` | 保存 context、outbox、active run |
| app database | Postgres | 保存 harness run/event，供后台监控 |
| admin monitor | `/admin/monitor` | 展示 source、queue、worker、harness、agent 行为 |

相关 systemd 单元：

```bash
systemctl status releaselog-ai-review.timer
systemctl status releaselog-ai-review.service
systemctl status releaselog-ai-goal-session.service
systemctl status releaselog-ai-goal-claude-session.service
```

`releaselog-ai-review.timer` 负责周期调度。`releaselog-ai-review.service` 执行 `scripts/ai-harness.mjs`。`releaselog-ai-goal-session.service` 和 `releaselog-ai-goal-claude-session.service` 是 CLI session 的辅助服务。

## 文件布局

harness 默认工作目录：

```text
var/ai-harness/
  context/
    <runId>.md
  outbox/
    <runId>.json
  state/
    active-run.json
```

这些是运行时文件，不应该提交到 git，也不应该放进 Docker image。

`context/<runId>.md` 是 harness 写给 agent 的任务包，里面包含：

- run id
- intent，比如 `release_publish` 或 `code_deploy`
- provider，比如 `codex` 或 `claude`
- repo root
- outbox 绝对路径
- required protocol
- pending release candidates
- local/public health
- Docker Compose 状态
- systemd timer 状态
- git status
- ready 的定义
- outbox schema 要求

`outbox/<runId>.json` 是 agent 写回来的正式结果。harness 不通过 tmux 文本判断完成，只通过这个 JSON 文件判断。

`state/active-run.json` 是 busy guard。上一轮还没写 outbox 且未过 deadline 时，下一轮 timer 会被记录为 busy 并跳过，避免两个 autonomous run 同时发布同一批候选。

## tmux 怎么用

tmux 在这里是交互式 CLI 的宿主。Codex CLI 和 Claude Code CLI 都是 terminal-first 工具，需要真实 TTY、登录态和交互上下文。harness 因此在 host 上运行它们，而不是放进 web 容器。

默认 session：

| Provider | tmux session | systemd helper |
|---|---|---|
| Codex | `releaselog-ai-goal` | `releaselog-ai-goal-session.service` |
| Claude Code | `releaselog-ai-goal-claude` | `releaselog-ai-goal-claude-session.service` |

查看 session：

```bash
tmux ls
```

进入 Codex session：

```bash
tmux attach -t releaselog-ai-goal
```

进入 Claude primary session：

```bash
tmux attach -t releaselog-ai-goal-claude
```

退出但不杀 session：

```text
Ctrl-b d
```

抓取最近屏幕内容：

```bash
tmux capture-pane -pt releaselog-ai-goal-claude -S -200
```

只有确认 session 卡死或需要重置登录态时才 kill：

```bash
tmux kill-session -t releaselog-ai-goal-claude
```

正常情况下不需要人工往 tmux 输入任务。`scripts/ai-harness.mjs` 会调用 `scripts/ai-session-send.mjs`，重启 provider session 并把 `/goal` prompt 直接作为 CLI 启动参数传入。

当前 Codex 启动命令来自 `scripts/ai-session-send.mjs`：

```bash
codex -C /root/releaselog \
  --dangerously-bypass-approvals-and-sandbox \
  --no-alt-screen
```

当前 Claude primary 启动命令：

```bash
claude --permission-mode dontAsk --allowedTools Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit --add-dir /root/releaselog
```

为什么要在 host 上运行：agent 需要看到真实 repo、Docker Compose、systemd、tmux、生产健康检查和 git 状态。web 容器里只应该跑应用，不应该拥有整个宿主机的运维视角。

## outbox 怎么用

outbox 是 agent 和 harness 之间的 durable handshake。

它解决了两个问题：

- Codex/Claude CLI 没有稳定的业务 callback，可以告诉外部系统“这次审阅完成了”。
- tmux 终端输出不是可靠协议，里面可能有颜色控制符、分页、换行、日志、重绘和自然语言解释。

因此完成信号被设计成文件：

1. harness 写 `context/<runId>.md`。
2. context 里明确写出 outbox path。
3. harness 用 `/goal` prompt 要求 agent 读取 context。
4. agent 完成审阅后，向 outbox path 写 exactly one JSON object。
5. harness 每 5 秒轮询 outbox，最多默认等 45 分钟。
6. outbox 出现后，harness parse JSON 并执行 schema/risk/intent 校验。

默认等待参数：

```bash
AI_HARNESS_WAIT_TIMEOUT_MS=2700000
AI_HARNESS_POLL_MS=5000
AI_HARNESS_BUSY_TIMEOUT_MS=3300000
```

一个 `release_publish` outbox 示例：

```json
{
  "runId": "2026-05-15T12-00-00-000Z-release_publish",
  "intent": "release_publish",
  "provider": "codex",
  "ready": true,
  "riskLevel": "low",
  "summary": "Reviewed the pending candidates and approved one official, non-duplicate release.",
  "environmentUnderstanding": {
    "dev": "Repo is /root/releaselog; validation command is npm run validate.",
    "runtime": "Production runs through Docker Compose on port 3000 with host-side systemd harness.",
    "data": "Candidates are reviewed before publish and stored separately from static seed data."
  },
  "decisions": [
    {
      "candidateId": "candidate-id",
      "action": "approve",
      "confidence": 0.92,
      "reason": "Official source confirms the release and existing published data does not already contain it."
    }
  ],
  "proposedCommands": [],
  "checksExpected": ["npm run validate"]
}
```

关键字段：

- `runId` 必须等于本次 run id，防止旧 outbox 被误用。
- `intent` 必须等于 harness 本次启动的 intent。
- `ready` 表示 agent 是否认为可以交给 harness 执行副作用。
- `riskLevel` 只能是 `low`、`medium` 或 `high`。`high` 会被自动阻断。
- `environmentUnderstanding.dev/runtime/data` 必须存在，证明 agent 已经理解开发、运行和数据边界。
- `decisions` 在 `release_publish` 里必须引用真实候选。
- `action` 必须是允许的枚举值，例如 `approve`、`reject` 或 `needs_review`。
- `proposedCommands` 只是建议，不会被 harness 盲目执行。

agent 如果发现证据不足、环境不健康、重复候选、CLI 权限异常或需要人工判断，应该写 `ready: false`，并在 `summary` 或 decision reason 里说明原因。

## harness 生命周期

入口：

```bash
node scripts/ai-harness.mjs
```

生产上由 `releaselog-ai-review.timer` 周期启动。手动 dry run：

```bash
cd /root/releaselog
AI_HARNESS_DRY_RUN=1 node scripts/ai-harness.mjs --intent=release_publish
AI_HARNESS_DRY_RUN=1 node scripts/ai-harness.mjs --intent=code_deploy
```

只注入任务、不等待 outbox：

```bash
AI_HARNESS_INJECT_ONLY=1 node scripts/ai-harness.mjs --intent=release_publish
```

主流程：

1. 加载 `.env.docker`。
2. 确定 root、base URL、public URL、context/outbox/state 路径。
3. 检查 `state/active-run.json`，避免并发 autonomous run。
4. 如果 intent 是 `auto`，有 pending candidates 时走 `release_publish`，否则走 `code_deploy`。
5. 选择 provider，优先 `claude`，失败时尝试 `codex`。
6. 收集运行上下文：候选 release、健康检查、Docker、systemd、git status。
7. 写 `context/<runId>.md`。
8. 构造 `/goal` prompt。
9. 通过 tmux 启动真实 CLI session。
10. 写 `active-run.json`。
11. 记录 `queued`、`context_written`、`goal_injected`、`waiting_for_outbox` 等事件。
12. 等待 outbox。
13. 验证 outbox。
14. `ready: false` 时记录 blocked 并停止。
15. `release_publish` 时调用应用 API 写入 AI review decision。
16. `code_deploy` 时执行 validate/build/Docker/health/timer gates。
17. 记录 `published`、`deployed`、`dry_run`、`blocked` 或 `failed`。
18. 清理 active run。

## 代码是怎么写的

主要文件：

```text
scripts/ai-harness.mjs
scripts/ai-session-send.mjs
app/api/cron/ai-harness/route.ts
lib/ai-harness-store.ts
lib/db.ts
lib/admin-monitor.ts
app/admin/monitor/
```

### `scripts/ai-harness.mjs`

这是 orchestrator。它负责收集 context、启动 CLI、等待 outbox、验证 outbox、执行发布或部署 gates。

关键配置：

```js
const root = process.env.RELEASELOG_ROOT || "/root/releaselog";
const envFile = process.env.RELEASELOG_ENV_FILE || join(root, ".env.docker");
const harnessRoot = process.env.AI_HARNESS_DIR || join(root, "var", "ai-harness");
const contextDir = join(harnessRoot, "context");
const outboxDir = join(harnessRoot, "outbox");
const stateDir = join(harnessRoot, "state");
const activeRunPath = join(stateDir, "active-run.json");
const waitTimeoutMs = Number.parseInt(process.env.AI_HARNESS_WAIT_TIMEOUT_MS || "2700000", 10);
const pollMs = Number.parseInt(process.env.AI_HARNESS_POLL_MS || "5000", 10);
const busyTimeoutMs = Number.parseInt(process.env.AI_HARNESS_BUSY_TIMEOUT_MS || "3300000", 10);
```

`collectContext()` 写出 agent 要看的事实。它把 required protocol、outbox schema、候选 release、健康检查、Docker 状态、timer 状态和 git 状态都放进 context。

`buildGoalPrompt()` 生成 `/goal` prompt。prompt 的核心是让 agent 阅读 context，并把 exactly one JSON object 写到 outbox path：

```text
Goal marker /goal: ReleaseLog autonomous harness task. Read <contextPath>,
follow the Required Protocol, and write exactly one JSON object to <outboxPath>.
Do not publish releases or deploy Docker/systemd directly; the harness will
validate ready state and run gates.
```

`waitForOutbox()` 是完成判定：

```js
async function waitForOutbox(outboxPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(outboxPath)) {
      return readJsonFile(outboxPath);
    }
    await sleep(pollMs);
  }
  throw new Error(`outbox_timeout:${outboxPath}`);
}
```

这里没有 callback，也没有解析 terminal。只要 outbox 文件出现，就读取并进入验证。

`validateOutbox()` 是安全边界：

```js
if (outbox.runId !== runId) throw new Error("outbox_run_id_mismatch");
if (outbox.intent !== intent) throw new Error("outbox_intent_mismatch");
if (!outbox.environmentUnderstanding?.dev ||
    !outbox.environmentUnderstanding?.runtime ||
    !outbox.environmentUnderstanding?.data) {
  throw new Error("outbox_missing_environment_understanding");
}
if (!["low", "medium", "high"].includes(risk)) throw new Error("outbox_invalid_risk_level");
if (risk === "high") throw new Error("outbox_high_risk_blocked");
```

`publishReleaseDecisions()` 只在 outbox 通过验证后执行。它把 agent decisions 发给应用的 `/api/cron/ai-review`，由应用侧完成候选发布或记录 review note。

`executeDeployGates()` 是 code deploy 的最终门禁。它会跑：

- `npm run validate`
- `npm run build`
- Docker Compose rebuild/restart
- local HTTP health
- public HTTP health
- worker status
- systemd timer active/enabled status

这就是为什么 agent 必须理解环境，但不能自己宣布生产已发布。`ready` 是 agent 的判断，部署成功必须由 gate 证明。

### `scripts/ai-session-send.mjs`

这个文件封装 tmux 和 provider。

`providerConfig()` 定义 Codex 和 Claude 的 session、service 和启动命令：

```js
{
  provider: "codex",
  command: "codex",
  sessionName: "releaselog-ai-goal",
  service: "releaselog-ai-goal-session.service",
  launchCommand: "exec codex -C '/root/releaselog' --dangerously-bypass-approvals-and-sandbox --no-alt-screen"
}
```

Claude primary：

```js
{
  provider: "claude",
  command: "claude",
  sessionName: "releaselog-ai-goal-claude",
  service: "releaselog-ai-goal-claude-session.service",
  launchCommand: "exec claude --permission-mode dontAsk --allowedTools 'Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit' --add-dir '/root/releaselog'"
}
```

`ensureProviderSession()` 用于确认 provider 可用：

- 检查 `tmux` 是否存在。
- 检查 provider command 是否存在。
- 如果 session 已存在，直接返回。
- 否则先尝试 `systemctl start <service>`。
- systemd 不可用时 fallback 到 `tmux new-session`。
- 最多等待 15 秒让 session 出现。

`restartProviderSessionWithPrompt()` 用于真实 run：

- kill 旧 session。
- 创建新 tmux session。
- 用 run-specific prompt 启动 CLI。
- 等待 session ready。

当前代码每个 run 都重启一次 session。这样做减少了上一轮对下一轮的污染，且仍然使用真实登录态 CLI。

### `app/api/cron/ai-harness/route.ts`

这是 host-side harness 写入数据库的受保护入口。

认证逻辑：

```ts
return request.headers.get("authorization") === `Bearer ${secret}`;
```

如果 body 是 event 或带 `phase`，路由调用 `recordAiHarnessEvent()`。否则调用 `recordAiHarnessRun()`。

这样 host 脚本不需要直接连 Postgres，也不需要知道容器内部网络。它只通过带 `CRON_SECRET` 的应用 API 写审计数据。

### `lib/ai-harness-store.ts`

这个文件写数据库。

`recordAiHarnessRun()` upsert `ai_harness_runs`，保存：

- id
- provider
- session name
- intent
- status
- ready
- risk level
- context path
- outbox path
- checks
- error
- metadata
- started/finished/updated timestamp

`recordAiHarnessEvent()` insert `ai_harness_events`，保存：

- run id
- provider
- session name
- intent
- phase
- level
- message
- metadata
- created timestamp

后台监控的价值来自 event stream。最终状态只能告诉你结果，event stream 能告诉你任务是卡在 provider、context、goal 注入、outbox、验证、publish 还是 deploy gate。

### `lib/db.ts`

这里初始化数据库 schema，包括 `ai_harness_runs` 和 `ai_harness_events`。checks 和 metadata 使用 JSONB，方便后续后台聚合和追溯。

### `lib/admin-monitor.ts` 和 `/admin/monitor`

管理员后台读取结构化事实，而不是读取 tmux 屏幕：

- 最近 harness runs
- 最近 harness events
- source registry 状态
- collector/queue 状态
- candidate 状态
- agent 行为摘要

因此后台能回答：

- 最近一次 autonomous run 是什么时候。
- 用的是 Claude primary 还是 Codex fallback。
- 是否已经注入 `/goal`。
- 是否等到了 outbox。
- outbox 是否通过验证。
- agent 是否认为 ready。
- harness 是否真的 publish/deploy。
- 如果失败，失败在哪个 phase。

## 为什么这套机制可靠

第一，outbox 是 durable completion signal。terminal 输出不是协议，进程退出也不代表业务完成。run-specific JSON 文件可以解析、校验、归档和复现。

第二，run id 绑定能防止旧结果污染新 run。文件路径和 JSON 里的 `runId` 都必须匹配。

第三，busy guard 防止重叠运行。每小时 timer 不会在上一轮还没结束时启动第二个 autonomous publish。

第四，agent 和副作用分离。agent 审阅，harness 发布。即使 agent 在 tmux 里说 ready，系统也只认 outbox 和 gates。

第五，risk gate 是硬边界。`riskLevel: high` 自动阻断；缺少环境理解自动阻断；release decision 引用不存在 candidate 自动失败。

第六，code deploy 有真实运行门禁。validate、build、Docker、local/public health、worker 和 timer 都必须通过。

第七，事件全量入库。管理员后台看到的是结构化 lifecycle，不是最终状态猜测。

第八，tmux 保留真实 CLI 能力。系统没有把 Codex/Claude 降级成单次 HTTP completion，而是让它们保持代码阅读、命令执行和工程审阅能力。

## 常用操作

检查 timer：

```bash
systemctl list-timers --all 'releaselog-ai-review*'
systemctl status releaselog-ai-review.timer
```

看最近 harness 日志：

```bash
journalctl -u releaselog-ai-review.service -n 200 --no-pager
```

手动 dry run：

```bash
cd /root/releaselog
AI_HARNESS_DRY_RUN=1 node scripts/ai-harness.mjs --intent=release_publish
AI_HARNESS_DRY_RUN=1 node scripts/ai-harness.mjs --intent=code_deploy
```

检查运行文件：

```bash
ls -lah /root/releaselog/var/ai-harness/context
ls -lah /root/releaselog/var/ai-harness/outbox
ls -lah /root/releaselog/var/ai-harness/state
jq . /root/releaselog/var/ai-harness/state/active-run.json
```

查最新 run：

```bash
docker compose exec db psql -U releaselog -d releaselog -c \
  "select id, intent, provider, status, ready, risk_level, started_at, finished_at from ai_harness_runs order by started_at desc limit 10;"
```

查最新事件：

```bash
docker compose exec db psql -U releaselog -d releaselog -c \
  "select run_id, phase, level, message, created_at from ai_harness_events order by created_at desc limit 30;"
```

看 Claude tmux 屏幕：

```bash
tmux capture-pane -pt releaselog-ai-goal-claude -S -200
```

## 常见失败和处理

CLI 不存在或未登录：

- 现象：provider 启动失败，run 记录 failed。
- 处理：在 host 上直接运行 `codex` 或 `claude`，确认命令存在且登录态有效。

outbox timeout：

- 现象：事件停在 `waiting_for_outbox` 后超时。
- 处理：查看 tmux 输出，确认 agent 是否卡在权限、网络、命令或任务理解上。

outbox 不是合法 JSON：

- 现象：`outbox_received` 后 failed。
- 处理：运行 `jq . var/ai-harness/outbox/<runId>.json`。常见错误是 agent 写了 markdown fence、多个 JSON object 或漏字段。

high risk blocked：

- 现象：agent 写 `riskLevel: "high"`。
- 处理：人工查看 summary。高风险任务需要拆小、补测试或手动处理。

release candidate 证据不足：

- 现象：decision 是 `reject` 或 `needs_review`。
- 处理：这是正常保护。检查 source URL、official evidence 和是否已发布过。

deploy gate failed：

- 现象：outbox ready，但 validate/build/Docker/health/timer gate 失败。
- 处理：先修 gate，不要绕过 harness。agent ready 不是部署成功证明。

stale active run：

- 现象：新 run 被 busy guard 拒绝。
- 处理：确认没有真实运行中的 harness，查看 journal 和 `active-run.json`。如果确认为陈旧状态，可以删除 state 文件后重跑。

## 安全边界

`/api/cron/ai-harness` 由 `CRON_SECRET` 保护。host-side harness 必须带 `Authorization: Bearer <CRON_SECRET>` 才能写 run/event。

outbox 是本地文件协议，不暴露到公网。

agent CLI 运行在 host 上，有较强观察能力和 repo 写入能力。因此必须坚持：

- agent 不直接 publish。
- agent 不直接 deploy Docker/systemd。
- release publish 走 harness 和应用 API。
- code deploy 走 harness gates。
- high risk 自动阻断。
- 事件全量入库。

Docker volume 保存生产数据；`var/ai-harness/` 保存 agent 协议运行文件。前者是产品状态，后者是审阅和审计状态，两者不要混用。

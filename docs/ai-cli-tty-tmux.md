# Codex 和 Claude Code 的 TTY / tmux 使用说明

这份文档只讲一件事：为什么 Codex CLI 和 Claude Code CLI 要放在 tmux 里跑，以及它们使用 TTY 的方式有什么区别。

尽量用很简单的话讲：

- **TTY** 就是一间“终端小房间”。人在这间房间里打字，程序在里面显示文字。
- **tmux** 就是一个“不会因为你关掉 SSH 就消失的终端小房间管理器”。
- **Codex CLI / Claude Code CLI** 就像两个会坐在终端里工作的助手。
- **harness** 就像值班经理。它把任务纸条递给助手，等助手把结果放进 outbox，再决定是否真的发布或部署。

关键结论：

- Codex 和 Claude 都需要一个像真实终端一样的环境，不能只当普通后台脚本跑。
- tmux 可以给它们一个长期存在的 TTY。
- Codex 接启动 prompt 比较直接。
- Claude Code 对参数顺序和权限更敏感。
- 不管 Codex 还是 Claude，都不要用终端文字判断“它审完了”。正式完成信号是 outbox JSON。

## 先讲 TTY 是什么

平时你 SSH 到服务器，看见这样的地方：

```bash
root@server:/root/releaselog#
```

这就是一个终端。程序如果要问你问题、显示进度、接收你按下的回车，就需要这个终端。

TTY 可以理解成“程序的键盘和屏幕”。

如果一个程序只是普通后台进程，它可能没有真正的键盘和屏幕。很多交互式 CLI 在这种环境里会：

- 启动后卡住
- 认为没人能输入
- 不显示完整内容
- 无法接收 prompt
- 无法保持登录会话

Codex CLI 和 Claude Code CLI 都是交互式工具，所以最好给它们一个真实的 TTY。

## tmux 是什么

tmux 是一个终端管理器。

可以把它想成“服务器上的一个小电视机”：

- 你打开电视机，里面跑着 Claude 或 Codex。
- 你关掉 SSH，电视机还在那里继续开着。
- 你下次 SSH 回来，还可以重新接上去看。
- harness 也可以往这个电视机里启动程序、发送任务、截屏查看。

常用命令：

```bash
tmux ls
```

看现在有哪些 tmux 房间。

```bash
tmux attach -t releaselog-ai-goal-claude
```

进入 Claude 的房间。

```bash
tmux attach -t releaselog-ai-goal
```

进入 Codex 的房间。

进入以后，按这个退出，但不关闭房间：

```text
Ctrl-b d
```

看最近屏幕内容：

```bash
tmux capture-pane -pt releaselog-ai-goal-claude -S -200
tmux capture-pane -pt releaselog-ai-goal -S -200
```

确认卡死后才杀掉房间：

```bash
tmux kill-session -t releaselog-ai-goal-claude
tmux kill-session -t releaselog-ai-goal
```

## 为什么不能只用普通后台命令

普通后台命令像这样：

```bash
node scripts/ai-harness.mjs
```

它适合 harness，因为 harness 是确定性的脚本。

但 Codex 和 Claude 是交互式 CLI。它们经常需要：

- 保持登录态
- 显示一个互动界面
- 接收一段任务文字
- 使用自己的工具系统读文件、写文件、运行命令
- 在执行中显示进度

所以它们更适合跑在 tmux TTY 里。

这里要分清两个角色：

- harness 是后台值班经理，可以普通后台运行。
- agent CLI 是坐在终端里的助手，应该有 TTY。

## Codex 和 Claude 的主要区别

| 项目 | Codex CLI | Claude Code CLI |
|---|---|---|
| 默认角色 | 当前 fallback | 当前 primary |
| tmux session | `releaselog-ai-goal` | `releaselog-ai-goal-claude` |
| systemd helper | `releaselog-ai-goal-session.service` | `releaselog-ai-goal-claude-session.service` |
| 启动时带 prompt | 比较直接 | 参数顺序很重要 |
| 写 outbox 权限 | 用 Codex 自己的 bypass 参数 | 需要 `--allowedTools` |
| root 下跳过权限 | 当前用 Codex bypass | Claude 不允许 root 使用 `--dangerously-skip-permissions` |
| 终端截屏 | `--no-alt-screen` 让截屏更稳定 | 可以截屏，但 TUI 输出有时只显示当前页 |
| 常见坑 | 没有 bypass 时写不了 outbox | `--add-dir` 可能吞掉 prompt；没有 allowed tools 时写不了 outbox |

## Codex 怎么放进 tmux

只启动一个 Codex 房间，不给任务：

```bash
tmux new-session -d \
  -s releaselog-ai-goal \
  -c /root/releaselog \
  'exec codex -C /root/releaselog --dangerously-bypass-approvals-and-sandbox --no-alt-screen'
```

给 Codex 一个任务并启动：

```bash
tmux new-session -d \
  -s releaselog-ai-goal \
  -c /root/releaselog \
  'exec codex -C /root/releaselog --dangerously-bypass-approvals-and-sandbox --no-alt-screen "Goal marker /goal: read the context file and write exactly one JSON object to the outbox path."'
```

这里几个参数的意思：

- `-C /root/releaselog`：告诉 Codex 工作目录是这个 repo。
- `--dangerously-bypass-approvals-and-sandbox`：允许 Codex 写 outbox、读 repo、执行必要命令。
- `--no-alt-screen`：不要切到另一块终端屏幕，这样 `tmux capture-pane` 更容易看到内容。

这个参数听起来危险，所以生产设计必须记住：Codex 只是写 outbox 和做审阅，真正发布和部署仍由 harness 校验后执行。

## Claude Code 怎么放进 tmux

只启动一个 Claude 房间，不给任务：

```bash
tmux new-session -d \
  -s releaselog-ai-goal-claude \
  -c /root/releaselog \
  'exec claude --permission-mode dontAsk --allowedTools Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit --add-dir /root/releaselog'
```

给 Claude 一个任务并启动：

```bash
tmux new-session -d \
  -s releaselog-ai-goal-claude \
  -c /root/releaselog \
  'exec claude "Goal marker /goal: read the context file and write exactly one JSON object to the outbox path." --permission-mode dontAsk --allowedTools Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit --add-dir /root/releaselog'
```

Claude 的重点：

- prompt 要放在 `--add-dir` 前面。
- `--add-dir` 后面只放目录。
- `--allowedTools` 要允许 Claude 读文件、搜索、运行命令、写 outbox。
- root 用户不能用 Claude 的 `--dangerously-skip-permissions`，Claude 会拒绝。

为什么 prompt 要放在 `--add-dir` 前面？

因为 Claude 的 `--add-dir <directories...>` 可以接很多目录。它看到后面的字，可能以为那些都是目录，而不是任务文字。结果就是 Claude 打开了，但没有收到任务。

错误例子：

```bash
claude --permission-mode dontAsk --add-dir /root/releaselog "请写 outbox"
```

这个写法容易让 prompt 被 `--add-dir` 吞掉。

推荐例子：

```bash
claude "请写 outbox" --permission-mode dontAsk --allowedTools Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit --add-dir /root/releaselog
```

## 为什么 Claude 需要 allowedTools

Claude Code 有自己的权限系统。

如果只写：

```bash
claude "写 outbox" --permission-mode dontAsk --add-dir /root/releaselog
```

它可能会说：我不能写文件，因为当前模式不允许 Write 或 Bash。

所以 harness 现在给 Claude 这些工具：

```text
Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit
```

简单解释：

- `Read`：读文件
- `Glob`：按文件名找文件
- `Grep`：按文字搜索
- `LS`：列目录
- `Bash`：运行命令
- `Write`：写新文件，比如 outbox
- `Edit`：改文件
- `MultiEdit`：一次改多个位置

这些工具让 Claude 像一个工程师一样看代码、查状态、写 outbox。

但这不代表 Claude 可以直接发布。发布权仍在 harness。

## harness 现在怎么做

代码在：

```text
scripts/ai-session-send.mjs
```

里面有两个关键函数：

```text
providerConfig()
providerPromptCommand()
```

`providerConfig()` 负责定义每个 agent 的默认房间和启动方式。

`providerPromptCommand()` 负责把本次 `/goal` 任务塞进启动命令。

当前 Claude primary 的核心命令形状是：

```bash
exec claude '<prompt>' \
  --permission-mode dontAsk \
  --allowedTools 'Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit' \
  --add-dir '/root/releaselog'
```

当前 Codex fallback 的核心命令形状是：

```bash
exec codex -C '/root/releaselog' \
  --dangerously-bypass-approvals-and-sandbox \
  --no-alt-screen \
  '<prompt>'
```

harness 会：

1. 写 context 文件。
2. 决定用 Claude 还是 Codex。
3. kill 旧 tmux session。
4. 用新的 prompt 创建 tmux session。
5. 写 active run。
6. 等 outbox JSON。
7. 校验 outbox。
8. 再由 harness 发布或部署。

## 如果要手动看它有没有收到任务

看 Claude：

```bash
tmux capture-pane -pt releaselog-ai-goal-claude -S -200
```

你应该能看到类似：

```text
Goal marker /goal: ReleaseLog autonomous harness task...
Read /root/releaselog/var/ai-harness/context/<runId>.md...
write exactly one JSON object to /root/releaselog/var/ai-harness/outbox/<runId>.json
```

看 Codex：

```bash
tmux capture-pane -pt releaselog-ai-goal -S -200
```

如果完全没有 session：

```bash
tmux ls
```

如果 session 不存在，先看 systemd：

```bash
systemctl status releaselog-ai-goal-claude-session.service --no-pager -l
systemctl status releaselog-ai-goal-session.service --no-pager -l
```

## 如何判断 agent 审完了

不要看它屏幕上说了什么。

正确看 outbox：

```bash
ls -lah /root/releaselog/var/ai-harness/outbox/
```

看 active run：

```bash
jq . /root/releaselog/var/ai-harness/state/active-run.json
```

假设 active run 里写着：

```json
{
  "runId": "abc",
  "outboxPath": "/root/releaselog/var/ai-harness/outbox/abc.json"
}
```

那就看：

```bash
jq . /root/releaselog/var/ai-harness/outbox/abc.json
```

只要 outbox JSON 出现，并且 harness 校验通过，才算正式完成。

这就像让助手把报告放进一个固定信箱。不能因为助手在房间里说“我好了”就当真，必须看到信箱里的正式报告。

## systemd 怎么帮 tmux 启动

当前两个 helper：

```bash
systemctl status releaselog-ai-goal-claude-session.service --no-pager -l
systemctl status releaselog-ai-goal-session.service --no-pager -l
```

Claude helper 做的事情大概是：

```bash
tmux has-session -t releaselog-ai-goal-claude \
  || tmux new-session -d -s releaselog-ai-goal-claude -c /root/releaselog \
    'exec claude --permission-mode dontAsk --allowedTools Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit --add-dir /root/releaselog'
```

Codex helper 做的事情大概是：

```bash
tmux has-session -t releaselog-ai-goal \
  || tmux new-session -d -s releaselog-ai-goal -c /root/releaselog \
    'exec codex -C /root/releaselog --dangerously-bypass-approvals-and-sandbox --no-alt-screen'
```

注意：helper 只保证有一个平时可进入的房间。真正每次 autonomous run，harness 会重启对应 session，并带上本次的 `/goal` prompt。

## 常见问题

### tmux 里看到了欢迎页，但没有任务

通常是 prompt 没传进去。

Claude 最常见原因：prompt 放在 `--add-dir` 后面，被当成目录了。

### Claude 说不能写 outbox

通常是工具权限不够。

确认命令里有：

```bash
--allowedTools Read,Glob,Grep,LS,Bash,Write,Edit,MultiEdit
```

### Claude root 下不能跳过权限

Claude Code 在 root/sudo 下不允许：

```bash
--dangerously-skip-permissions
```

所以这里用 `dontAsk + allowedTools`，不是用 `dangerously-skip-permissions`。

### Codex 看不到完整屏幕

确认 Codex 有：

```bash
--no-alt-screen
```

这个参数让 tmux 更容易截取正在显示的内容。

### systemd start 成功，但 tmux session 没有出现

不能只相信 systemd 返回成功。要检查：

```bash
tmux has-session -t releaselog-ai-goal-claude
tmux has-session -t releaselog-ai-goal
```

当前 `scripts/ai-session-send.mjs` 已经做了这个检查：systemd start 后如果 session 还不存在，会再尝试直接 `tmux new-session`。

### agent 一直在思考

先看 active run deadline：

```bash
jq . /root/releaselog/var/ai-harness/state/active-run.json
```

再看 tmux：

```bash
tmux capture-pane -pt releaselog-ai-goal-claude -S -200
```

如果没到 deadline，通常继续等。如果过了 deadline，harness 会按 timeout 处理。

## 最后再说一遍

TTY 和 tmux 只是给 agent 一个能工作的“房间”。

真正的安全设计不是 tmux，而是这三件事：

1. harness 给 agent 明确 context 和 outbox path。
2. agent 只写 outbox，不直接发布。
3. harness 校验 outbox，再执行 publish/deploy gate。

所以 Codex 和 Claude 都可以坐在 tmux 里工作；区别只是它们怎么进房间、怎么接任务、怎么拿权限。

# Reset Log 漏收与第三方信源调研 — 2026-11-03

发布状态：本文前半部分记录修复前的调研快照。11月3日已上线统一服务端公开信源聚合、每小时按需缓存刷新和来源标注，实际实现不新增数据库表。验收与回滚见 [site-refresh-20261103.md](site-refresh-20261103.md)。

## 已确认的漏收原因

线上 https://releaselog.site/reset-log 显示最近事件2026-05-15。app/reset-log/ResetLogList.tsx调用data/reset-log.ts的getResetEventsSorted()读取静态RESET_EVENTS，并未查询采集数据库。当前source-registry.json仅固定跟踪一条2026-05-15的Claude重置原帖，不能发现此作者后续新事件。单纯多开抓取任务或给AI换模型，不能让静态页面自动更新。

## 可复用的第三方源（全部已实际打开，标注格式）

| 来源 | 格式/用途 | 地址 |
|---|---|---|
| willcodexresets | 无需key的JSON；优先发现源，UTC、类型、官方原帖ID/URL | https://willcodexresets.com/api/docs |
| LimitDigest | Claude历史及官网RSS；RSS实测200并解析14items，须过滤非重置主题 | https://limitdigest.com/resets/claude/log/ / https://limitdigest.com/rss.xml |
| CodexLimits | 历史归档与官方原帖，区分观测和公告 | https://codexlimits.com/reset-history |
| WhenReset | Claude历史表，附原帖与后续确认 | https://whenreset.dev/claude |
| TiboSay | Codex28天挑战记录，区分产品改进/重置 | https://tibosay.com/tibo-28 |
| Codex Reset | 当前事件、撤回/未确认/预测状态 | https://codex-reset.app/ |
| ToolsForDevs | Claude/Codex双模型跟踪，整体重置与banked额度分别统计 | https://toolsfordevs.app/ |
| Codex Daily Tracker | 28天日历；纽约时区，作为补充 | https://codex.jdhyman.com/ |

JSON接口实测：https://willcodexresets.com/api/resets?limit=5，HTTP200。注意stats.latest与当前返回的banked事件时间不是同一概念，不得盲取stats.latest作为所有事件的最新时间。

## 已交叉核对的漏收实例

- Codex2026-11-01 23:27:20UTC banked额度，官方作者thsottiaux原帖：https://x.com/thsottiaux/status/2117035794678546764 。官方URL在浏览工具中403；通过FxTwitter原帖镜像核对author/id/created_at/text，并与多个第三方归档一致。这不是所有账户额度均已恢复的证明。
- Claude2026-10-30 17:29:07UTC方案/限额调整，原帖：https://x.com/claudeai/status/2116220869479428500 。镜像核对确认：Max命名调整、已验证Ultra账号逐步移除5小时限制；周额度不变，不能简化为全员无限量。
- Claude2026-09-22 16:44:06UTC限额与可领取重置额度，原帖：https://x.com/ClaudeDevs/status/2102438800836489554 。一次性可领取额度与自动重置需分别展示。
- Claude2026-08-29公告、09-14生效的周额度调整，原帖：https://x.com/ClaudeDevs/status/2093742321473065266 。必须分开记录公告日和生效日。

## 最小自动采集方案

1. JSON与RSS作为发现入口，HTML归档作交叉核验；保留source tier、观察时间、canonical original URL。相同官方原帖ID只生成一个事件，多家转载不算多份独立事实。
2. 区分global reset、banked credit、limit change、expiry、forecast、withdrawn；只有真实公告/已发生变化进入历史，预测不冒充事实。直接官方URL不可达时可保留第三方reported状态，原帖镜像和多个归档一致后提高置信度，整个流程自动完成。
3. 已采用统一服务端公开信源聚合，保留旧静态条目与已核验新记录作为故障兜底；列表、代理分类、详情和sitemap使用同一数据来源，不新增数据库依赖。
4. 不因新来源增加每分钟LLM调用。按新事件ID/内容hash去重，规则解析可确定字段，确有歧义才进入每小时批量AI判定。无法达到发布证据门槛则自动拒绝或标注reported，不再等待人工重复审阅。

本轮完成联网搜索、API/RSS探测、漏收根因定位与来源清单。Reset Log页面与采集数据库的连接尚未修改/部署，不把研究清单宣称为已经上线的采集能力。现有source-registry.json与lib/source-queue.ts有预先存在的工作区修改，未覆盖。

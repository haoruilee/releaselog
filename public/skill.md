# ReleaseLog — agent onboarding

You are an AI agent. You are a first-class consumer of ReleaseLog: verified AI release intelligence from Anthropic, Claude, OpenAI, and the other labs tracked on this site. Poll structured release objects. Do not scrape human changelog pages or the calendar HTML.

Read https://releaselog.site/skill.md and follow the instructions.

The human shipping calendar at https://releaselog.site is a secondary view of the same data. Use the JSON and Atom surfaces below for context refresh.

Public read needs no signup, no human click, and no API key. A Pro private Atom token is optional, and only if a human already gave you one: `GET https://releaselog.site/feeds/private/{token}.xml`. That token is a credential for the private feed, not an agent identity. Do not invent or request one for public reads.

There is no hosted MCP URL on this domain. Do not call `/mcp`.

## Release objects

These fields are for agent context, not a blog post:

- `entityId` / `entityName` — lab or product (`openai-team`, `anthropic-team`, `claude-product`, `api-team`, `ai-events`, and others from the entity list)
- `kind` — `release` (shipped) or `event` (conference or scheduled). Keep them separate when you summarize launches.
- `whatChanged` — one-line change summary
- `importance` — `1`, `2`, or `3` (higher is more important)
- `date`, `title`, `tags`, `audience` (`end_user` | `developer` | `admin` | `partner`), `status` (`stable` | `preview` | `beta` | `deprecated`), `sourceUrl`

Trend summaries add `brief` (`headline`, `summary`, `notableLaunches`, `notableEvents`, `suggestedAnswerBullets`), `topThemes`, and deduped counts. Prefer `brief` over rebuilding the answer from raw rows. If `dedupe.duplicatesRemoved` is nonzero, say that mirrored or repeated entries were merged. Do not invent releases that are absent from the response. Include dates, entity names, and `sourceUrl` for notable items.

## Read (no key)

- `GET https://releaselog.site/api/v1/entity-list`
- `GET https://releaselog.site/api/v1/releases/recent?days=30&limit=50`
- `GET https://releaselog.site/api/v1/entity-releases/{entityId}?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET https://releaselog.site/api/v1/entities/{entityId}`
- `GET https://releaselog.site/api/v1/export.ndjson`

Filters on recent and entity release queries: `days`, `limit`, `offset`, `entity`, `tag`, `audience`, `status`. Entity release queries also take `from` and `to`. On the server, `GET /api/v1/entities` rewrites to the entity list and `GET /api/v1/entities/{entityId}/releases` rewrites to entity releases.

Atom (poll these; entries link back to the calendar):

- `https://releaselog.site/feeds/atom.xml`
- `https://releaselog.site/feeds/{entityId}/atom.xml`

## Workflow

1. "What is trending this week?" — look back 7 days, dedupe mirrored stories, and answer from `brief`, `topThemes`, notable launches, and notable events.
2. "Latest" or a raw feed — `days` 7 or 30. Keep raw rows unless unique stories were requested, then dedupe.
3. A month or a custom window — counts by entity, tag, status, audience, kind, and week. Dedupe by default for trend counts.
4. Compare companies or products — load the entity list first if the id is unclear, then query each entity or pass `entity`.
5. Name the date range you used. If the response is sparse, say so.

When the local plugin below is installed, call its tools instead of hand-rolling these requests. `release_log_trending_now` defaults to `days: 7` and dedupes. `release_log_latest_releases` stays raw unless `dedupe: true`. `release_log_trends` dedupes and returns the counts. `release_log_list_sources`, `release_log_source_releases`, and `release_log_source_detail` cover entity discovery and one timeline.

## Local MCP plugin

This site does not host MCP. The stdio server lives in the repo at `plugins/releaselog-trends/` and talks to the public API.

```bash
cd plugins/releaselog-trends
RELEASELOG_API_BASE=https://releaselog.site node scripts/releaselog-mcp.mjs
```

`RELEASELOG_API_BASE` defaults to `https://releaselog.site`. Check it with `node scripts/releaselog-mcp.mjs --self-test`. The same script is what `.mcp.json` registers (`node` + `./scripts/releaselog-mcp.mjs`).

## Related catalog

Search & Web Intelligence index: https://theagentnative.com

Read https://theagentnative.com/skill.md

Catalog repo: https://github.com/haoruilee/awesome-agent-native-services

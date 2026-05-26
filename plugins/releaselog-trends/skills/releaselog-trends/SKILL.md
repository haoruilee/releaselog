---
name: releaselog-trends
description: Use when the user asks for latest AI release trends, AI changelog summaries, launch activity, ReleaseLog data, or comparisons of AI company/product releases from releaselog.site.
---

# ReleaseLog Trends

Use this skill to answer questions about current AI release activity using the ReleaseLog API at `https://releaselog.site`.

## Data Source

Prefer the `releaselog-trends` MCP tools when they are available. If the MCP server is not available, query the public JSON API directly:

- `GET https://releaselog.site/api/v1/entity-list`
- `GET https://releaselog.site/api/v1/releases/recent?days=30&limit=50`
- `GET https://releaselog.site/api/v1/entity-releases/{entityId}?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET https://releaselog.site/api/v1/entities/{entityId}`

Supported filters include `days`, `limit`, `offset`, `entity`, `tag`, `audience`, and `status`. Entity release queries also support `from` and `to`.

## Workflow

1. For "what is trending this week?" or similar user-facing trend questions, call `release_log_trending_now` first. It defaults to `days: 7`, deduplicates repeated/mirrored stories, and returns `brief`, `topThemes`, `notableLaunches`, and `notableEvents`.
2. For "latest" or raw feed requests, fetch recent releases with `release_log_latest_releases` and use `days: 7` or `days: 30` depending on the wording. Keep raw feed behavior unless the user asks for unique stories, then pass `dedupe: true`.
3. For broader monthly or custom trend requests, use `release_log_trends` so counts by entity, tag, status, audience, kind, week, and theme are available. It deduplicates by default.
4. For company or product comparisons, call `release_log_list_sources` first if the exact entity id is unclear, then query each entity or use the `entity` filter.
5. Separate `kind: "event"` entries from shipped releases when summarizing launch activity.
6. Include concrete dates, entity names, and source URLs for notable items. Mention deduplication when `dedupe.duplicatesRemoved` is nonzero. Do not invent releases that are not in the API response.

## Response Style

- Start with the main trend or newest important item.
- Mention the API date range used, such as `2026-04-27` to `2026-05-26`.
- Prefer concise grouped summaries: top entities, top tags, notable launches, and upcoming/official events.
- Prefer the tool's `brief.headline`, `brief.summary`, and `brief.suggestedAnswerBullets` over reconstructing the whole answer from raw items.
- If the API response has sparse data, say so and report what was returned.

## MCP Tool Hints

- Use `release_log_trending_now` for "what is trending this week" and other one-shot user-facing trend summaries.
- Use `release_log_trends` for custom monthly/weekly trend summaries or when you need the full counts and raw notable/latest lists.
- Use `release_log_latest_releases` for a raw latest feed.
- Use `release_log_source_releases` for one team/product timeline.
- Use `release_log_list_sources` to discover entity ids.
- Use `release_log_source_detail` for metadata about a specific entity.

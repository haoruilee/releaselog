# ReleaseLog Trends

Personal Codex plugin for querying the public ReleaseLog API and summarizing latest AI release trends.

## Components

- `skills/releaselog-trends/SKILL.md` tells Codex when and how to use ReleaseLog data.
- `.mcp.json` registers a local MCP server.
- `scripts/releaselog-mcp.mjs` exposes tools for latest releases, trend summaries, source lists, source timelines, and source details.

The MCP server defaults to `https://releaselog.site` and can be pointed at another compatible deployment with `RELEASELOG_API_BASE`.

## Usability Notes

- Use `release_log_trending_now` for user-facing "what is trending this week?" questions. It defaults to a 7-day window and returns a concise `brief`, `topThemes`, `notableLaunches`, and `notableEvents`.
- `release_log_trends` now deduplicates by default, so mirrored event entries and repeated crawls of the same source URL do not dominate trend counts.
- `release_log_latest_releases` and `release_log_source_releases` keep raw-feed behavior by default, but accept `dedupe: true` when the caller wants unique stories.
- Every trend response includes `dedupe.groups` so callers can explain when repeated/mirrored ReleaseLog entries were merged.

## Quick Test

```bash
node scripts/releaselog-mcp.mjs --self-test
```

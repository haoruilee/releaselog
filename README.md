# releaselog

Static ReleaseLog: curated release data in `data/entities/`, listed in `data/entity-registry.json`.

- **Dev:** `npm run dev`
- **Validate data:** `npm run validate` (also runs automatically before `npm run build`)
- **Read API (v1):** `GET /api/v1/entities`, `/api/v1/entities/:id`, `/api/v1/entities/:id/releases`, `/api/v1/releases/recent?days=30`, `/api/v1/export.ndjson`

Adding a new feed: create `data/entities/<slug>.json`, append its filename to `data/entity-registry.json`, register the same filename in `data/load-entities.ts`, then `npm run validate`.

# releaselog

Static ReleaseLog: curated release data in `data/entities/`, listed in `data/entity-registry.json`.

- **Dev:** `npm run dev`
- **Validate data:** `npm run validate` (also runs automatically before `npm run build`)
- **Read API (v1):** `GET /api/v1/entities`, `/api/v1/entities/:id`, `/api/v1/entities/:id/releases`, `/api/v1/releases/recent?days=30`, `/api/v1/export.ndjson` (on a server, these first three paths are rewritten internally). **Static / GitHub Pages** uses file URLs `GET /api/v1/entity-list`, `/api/v1/entities/:id`, `/api/v1/entity-releases/:id`, `/api/v1/releases/recent` (no query filters on the static build).
- **Subscribe:** `/subscribe` — Atom feeds at `/feeds/atom.xml` and `/feeds/{entityId}/atom.xml` (readers poll; entries link back to the calendar). Optional weekly email: set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `DIGEST_FROM_EMAIL`, `CRON_SECRET`, and deploy on Vercel (`vercel.json` cron hits `/api/cron/weekly-digest` with `Authorization: Bearer CRON_SECRET`).

Set **`NEXT_PUBLIC_SITE_URL`** to your canonical origin (e.g. `https://your-domain.com`) so feeds and emails use correct absolute links.

### GitHub Pages

1. Repo **Settings → Pages**: **Source** = **GitHub Actions**.
2. Push to `main`; workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs `STATIC_EXPORT=1` and uploads `out/`.
3. For project sites, set **`NEXT_PUBLIC_BASE_PATH`** to `/<repository-name>` and **`NEXT_PUBLIC_SITE_URL`** to `https://<owner>.github.io/<repository-name>` (the workflow does this automatically). For a **`username.github.io`** repo, edit the workflow env to use an empty base path and `https://username.github.io`.
4. **`npm run build:pages`** builds the same export locally. Email signup and cron digest are **not** available on static hosting (Atom feeds and the calendar still work).


Adding a new feed: create `data/entities/<slug>.json`, append its filename to `data/entity-registry.json`, register the same filename in `data/load-entities.ts`, then `npm run validate`.

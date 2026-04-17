# releaselog

Static ReleaseLog: curated release data in `data/entities/`, listed in `data/entity-registry.json`.

- **Dev:** `npm run dev`
- **Validate data:** `npm run validate` (also runs automatically before `npm run build`)
- **Read API (v1):** `GET /api/v1/entities`, `/api/v1/entities/:id`, `/api/v1/entities/:id/releases`, `/api/v1/releases/recent?days=30`, `/api/v1/export.ndjson` (on a server, these first three paths are rewritten internally). **Static / GitHub Pages** uses file URLs `GET /api/v1/entity-list`, `/api/v1/entities/:id`, `/api/v1/entity-releases/:id`, `/api/v1/releases/recent` (no query filters on the static build).
- **Subscribe:** `/subscribe` — Atom feeds at `/feeds/atom.xml` and `/feeds/{entityId}/atom.xml` (readers poll; entries link back to the calendar). Optional weekly email: set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `DIGEST_FROM_EMAIL`, `CRON_SECRET`, and deploy on Vercel (`vercel.json` cron hits `/api/cron/weekly-digest` with `Authorization: Bearer CRON_SECRET`).
- **Pro / subscriptions:** deploy on a server runtime. Set `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `RESEND_API_KEY`, optional `MAIL_PROVIDER`, `DIGEST_FROM_EMAIL`, optional `AUTH_FROM_EMAIL`, optional `VIP_FROM_EMAIL`, `ADMIN_EMAILS`, `PRIVATE_FEED_SIGNING_SECRET`, and `CRON_SECRET`. Sign-in uses magic links, billing uses Stripe Checkout + Customer Portal, and private RSS lives at `/feeds/private/{token}.xml`. When `VIP_FROM_EMAIL` is set, active subscribers receive login and release emails from that sender. Set `MAIL_PROVIDER=resend` to prefer Resend over SMTP when both are configured.
- **Admin + ingest:** `/admin/candidates`, `/admin/releases`, `/admin/subscribers`; ingestion cron is `/api/cron/ingest`.

Set **`NEXT_PUBLIC_SITE_URL`** to your canonical origin (e.g. `https://your-domain.com`) so feeds and emails use correct absolute links.

### GitHub Pages

GitHub Pages export is now a legacy public-only path. The new Pro/auth/billing/admin features require a server deployment and are not available on static hosting.

1. Repo **Settings → Pages**: **Source** = **GitHub Actions**.
2. Manually run workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) if you still want a static public snapshot; server-only features are excluded.
3. For project sites, set **`NEXT_PUBLIC_BASE_PATH`** to `/<repository-name>` and **`NEXT_PUBLIC_SITE_URL`** to `https://<owner>.github.io/<repository-name>` (the workflow does this automatically). For a **`username.github.io`** repo, edit the workflow env to use an empty base path and `https://username.github.io`.
4. **`npm run build:pages`** is only for the legacy static snapshot. Pro login, billing, private RSS, admin pages, and server cron endpoints require Vercel or another server runtime.


Adding a new feed: create `data/entities/<slug>.json`, append its filename to `data/entity-registry.json`, register the same filename in `data/load-entities.ts`, then `npm run validate`.

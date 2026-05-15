# ReleaseLog Runbook

Operational notes for the production deploy at `https://releaselog.site`
(Ubuntu 24.04 + systemd + named Cloudflare tunnel + Postgres + Next.js).

See `README.md` for product/feature documentation. This file is for operators.

---

## Deployment layout

| Piece | Where |
|---|---|
| App code | `/root/releaselog` |
| Env file | `/root/releaselog/.env.local` (gitignored) |
| App service | `systemctl status releaselog.service` → runs `npm run start` on `PORT=3000` |
| Public URL | `https://releaselog.site` via `cloudflared-releaselog.service` |
| Tunnel config | `/root/.cloudflared/config.yml` (named tunnel `71a2a91d-...`) |
| Database | Local Postgres, URL in `.env.local` as `DATABASE_URL` |

The app process does NOT hot-reload `.env.local` — it reads env at startup only
(via `source .env.local` in the systemd unit). Any env change requires a
restart.

---

## Restart / rebuild cheatsheet

```bash
# Code change only (no dep/schema change): rebuild + restart
cd /root/releaselog && npm run build && sudo systemctl restart releaselog.service

# Env change only (no code change): restart is enough
sudo systemctl restart releaselog.service

# Verify the service came up
systemctl is-active releaselog.service          # expect: active
curl -sS -o /dev/null -w "%{http_code}\n" https://releaselog.site/  # expect: 200

# Tail logs
sudo journalctl -u releaselog.service -f
```

If `npm run build` fails, the previous `.next/` build still runs — safe to
inspect and retry. Don't `systemctl stop` until the rebuild succeeds.

## Dockerized layout

The repo also has a Docker Compose layout for separating immutable app code
from mutable runtime state:

| Piece | Docker location |
|---|---|
| App code | Built into `releaselog-app:<tag>` from `Dockerfile` |
| Runtime env | `.env.docker` (gitignored, usually copied from `.env.local`) |
| Postgres data | Docker named volume `releaselog_postgres-data` |
| Dev dependencies | Docker named volume `releaselog_node-modules` |
| Dev Next cache | Docker named volume `releaselog_next-cache` |
| Source registry | DB table `release_sources`, seeded from entity `brandUrl` plus `data/source-registry.json` |
| Fetch queue | DB table `fetch_jobs`, consumed by `collector-worker` |
| Fetch audit | DB tables `source_fetch_runs` and `release_events` |
| AI review | Host systemd timer `releaselog-ai-review.timer`, calls real `claude` or `codex` CLI |

The base Compose file intentionally contains no published port. Use one of the
overrides below so local development, staging, and production can bind different
host ports without changing the service definition.

`NEXT_PUBLIC_*` values are passed as Docker build args and may be embedded in
client assets. Rebuild the app image after changing them.

### Development

```bash
cd /root/releaselog
cp .env.docker.example .env.docker
# edit .env.docker: set secrets if you need Stripe/email/cron flows locally
# leave APP_PORT unset for the default dev port 3001

docker compose --env-file .env.docker \
  -f compose.yaml -f compose.dev.yaml \
  up --build

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/
```

Development mounts the repo into `/app`, but keeps `node_modules`, `.next`, and
Postgres state in Docker named volumes.

### Production Dry Run

Run the containerized stack beside the current systemd service before cutover:

```bash
cd /root/releaselog
cp .env.local .env.docker
cat >> .env.docker <<'EOF'
APP_PORT=3300
POSTGRES_DB=releaselog
POSTGRES_USER=releaselog
POSTGRES_PASSWORD=replace-with-a-long-random-password
NEXT_PUBLIC_SITE_URL=https://releaselog.site
EOF

docker compose --env-file .env.docker \
  -f compose.yaml -f compose.prod.yaml \
  up -d --build db app

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3300/
```

This starts a fresh empty Postgres volume. Import the current production data
before doing a real cutover.

### Import Current Postgres Into Docker

```bash
cd /root/releaselog
mkdir -p backups
set -a; . /root/releaselog/.env.local; set +a
pg_dump -Fc "$DATABASE_URL" -f "backups/releaselog-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose --env-file .env.docker -f compose.yaml up -d db

# Replace the filename with the dump generated above.
docker compose --env-file .env.docker -f compose.yaml exec -T db \
  sh -lc 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backups/releaselog-YYYYMMDDTHHMMSSZ.dump
```

The app auto-creates missing tables on first DB access, but the dump/restore
path preserves users, subscriptions, feed tokens, candidates, and notification
history.

### Production Cutover

Only do this after the dry run and data restore are verified.

```bash
cd /root/releaselog
# In .env.docker, set APP_PORT=3000 so cloudflared still targets 127.0.0.1:3000.

sudo systemctl disable --now \
  releaselog-ingest.timer \
  releaselog-send.timer \
  releaselog-weekly-digest.timer \
  releaselog.service

docker compose --env-file .env.docker \
  -f compose.yaml -f compose.prod.yaml -f compose.workers.yaml \
  up -d --build

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
curl -sS -o /dev/null -w "%{http_code}\n" https://releaselog.site/
```

`compose.workers.yaml` replaces the app-side systemd timers and runs continuous
queue workers:

| Container | Endpoint | Schedule |
|---|---|---|
| `send-worker` | `/api/cron/send-notifications` | every 60 seconds |
| `source-scheduler-worker` | `/api/cron/source-scheduler` | every 30 seconds |
| `collector-worker` | `/api/cron/fetch-jobs?limit=5` | every 10 seconds |
| `weekly-digest-worker` | `/api/cron/weekly-digest` | Mondays 09:00 UTC |

The legacy `/api/cron/ingest` route remains as a compatibility entrypoint. It
now runs one scheduler pass plus one collector pass.

### Autonomous AI Harness

The review/deploy step is intentionally host-side because it uses the real
logged-in `codex` CLI on this machine, with `claude` as fallback. The CLI runs
as a persistent tmux session and receives `/goal` tasks from the harness. Codex
runs without its own sandbox so it can write the outbox and make repo edits; the
harness, not the CLI terminal output, owns publish/deploy authority.

```bash
sudo cp /root/releaselog/deploy/releaselog-ai-goal-session.service /etc/systemd/system/
sudo cp /root/releaselog/deploy/releaselog-ai-goal-claude-session.service /etc/systemd/system/
sudo cp /root/releaselog/deploy/releaselog-ai-review.service /etc/systemd/system/
sudo cp /root/releaselog/deploy/releaselog-ai-review.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now releaselog-ai-goal-session.service
sudo systemctl enable --now releaselog-ai-review.timer

systemctl list-timers --all 'releaselog-ai-review*'
journalctl -u releaselog-ai-review.service -n 100 --no-pager
tmux attach -t releaselog-ai-goal
```

`scripts/ai-harness.mjs` reads pending candidates from
`http://127.0.0.1:3000/api/cron/ai-review`, generates a dev/runtime context
file, injects a `/goal` into the persistent tmux CLI, and waits for a structured
outbox file under `var/ai-harness/outbox/`. The CLI must write `ready=true`
before anything is published. The harness then runs the fixed gates and calls
the app API itself.

Release publish rules:

- auto-publish only happens when the outbox is valid and the candidate apply API
  accepts the decision
- `action=approve` still requires `confidence >= 0.85`; lower confidence stays
  pending with an AI review note
- the CLI must not call the publish API directly except in dry-run experiments

Code deploy rules:

- the CLI can inspect/edit the repo during the `/goal` session
- deploy only happens after `npm run validate`, `npm run build`, Docker Compose
  rebuild, local/public HTTP health, worker status, and timer status pass
- high-risk outbox results are blocked automatically

Useful env values in `.env.docker`:

```bash
AI_REVIEW_CLI=codex               # claude or codex
AI_REVIEW_BATCH_LIMIT=8
AI_REVIEW_MAX_BUDGET_USD=2
AI_REVIEW_DRY_RUN=0               # set to 1 to record decisions without applying
AI_HARNESS_PRIMARY_CLI=codex
AI_HARNESS_FALLBACK_CLI=claude
AI_HARNESS_INTENT=auto            # release_publish, code_deploy, or auto
AI_HARNESS_WAIT_TIMEOUT_MS=2700000
AI_HARNESS_DRY_RUN=0
GITHUB_TOKEN=                     # optional, raises GitHub API rate limit
BROWSERLESS_CONTENT_URL=          # optional browser fallback endpoint
```

The current run artifacts are local-only and ignored by git:

```bash
ls -la /root/releaselog/var/ai-harness/
```

Rollback is straightforward while the old files remain in place:

```bash
cd /root/releaselog
docker compose --env-file .env.docker \
  -f compose.yaml -f compose.prod.yaml -f compose.workers.yaml \
  down

sudo systemctl disable --now releaselog-ai-review.timer
sudo systemctl disable --now releaselog-ai-goal-session.service
sudo systemctl disable --now releaselog-ai-goal-claude-session.service

sudo systemctl enable --now \
  releaselog.service \
  releaselog-ingest.timer \
  releaselog-send.timer \
  releaselog-weekly-digest.timer
```

Do not disable the host PostgreSQL cluster just because ReleaseLog has moved to
Docker. This host may have other local services using the same Postgres daemon.

---

## Stripe: test → live switchover

Test mode is fully wired (validated 2026-04-17). When promoting to live:

### 1. Create the live webhook endpoint

Dashboard must have the **Test mode toggle OFF**.

1. Developers → Webhooks → **Add endpoint**
2. Endpoint URL: `https://releaselog.site/api/webhooks/stripe`
3. Events (exactly these four):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Create → copy the **Signing secret** (`whsec_...`)

### 2. Get the live Price IDs

Product catalog (still live mode) → open the subscription product → copy the
`price_...` ID for the monthly and yearly prices. These are different from
test-mode Price IDs.

### 3. Swap `.env.local`

```bash
# Open .env.local and update these four:
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...           # live endpoint's secret
STRIPE_PRICE_PRO_MONTHLY=price_...        # live monthly
STRIPE_PRICE_PRO_YEARLY=price_...         # live yearly
```

If the test-mode Dashboard endpoint also points at production, keep both modes
configured so Stripe test retries can still be accepted:

```bash
STRIPE_LIVE_SECRET_KEY=sk_live_...
STRIPE_LIVE_WEBHOOK_SECRET=whsec_...      # live endpoint's secret
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...      # test endpoint's secret
```

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` remain supported as the default
mode used by Checkout and the Customer Portal.

### 4. Restart and verify

```bash
sudo systemctl restart releaselog.service

# Configuration smoke test: webhook handler should return 400 (bad signature),
# not 503 (stripe_unconfigured). 400 proves the signing secret is loaded.
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST -H "stripe-signature: fake" --data '{}' \
  https://releaselog.site/api/webhooks/stripe
# expect: 400
```

### 5. First real Checkout

Do one real Checkout from a private/incognito browser — small amount if
possible. Then verify the row landed:

```bash
DB_URL=$(grep '^DATABASE_URL=' /root/releaselog/.env.local | cut -d= -f2-)
psql "$DB_URL" -c "select status, current_period_end, updated_at
                   from subscriptions order by updated_at desc limit 3"
```

`status` should be `active` and `current_period_end` should be ~1 month (or
~1 year) after `updated_at`.

Refund yourself via Dashboard → Customers → the subscription's most recent
invoice → Refund, if the charge was only for verification.

---

## Stripe: keeping test mode usable

Test and live are separate universes. Keep the test artifacts so you can do
full end-to-end dev without touching real money:

- A test-mode copy of the product + monthly + yearly price
- A test-mode webhook endpoint pointing at `releaselog.site/api/webhooks/stripe`
  (or at `localhost:3000/api/webhooks/stripe` via `stripe listen` when coding
  locally)

The **`stripe` CLI** is installed at `/usr/local/bin/stripe` (v1.40.6 as of
2026-04-17). Commands used for debugging:

```bash
# List recent events (either mode, depending on which key is current)
stripe events list --limit 5

# Replay an event to a specific endpoint
stripe events resend evt_XXX --webhook-endpoint we_YYY

# Trigger a synthetic event (creates real test-mode customer/subscription)
stripe trigger customer.subscription.created

# Forward webhooks to localhost during dev
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Magic-link auth troubleshooting

**Gmail pre-fetches links.** Gmail's security scanner will hit magic links
before a human clicks them, consuming the one-shot token. Symptom: every
sign-in attempt lands on `/login?error=invalid_token`.

Mitigations (pick the one that fits):

1. **Right-click → Copy Link Address**, then paste the URL into the address
   bar yourself. Don't let Gmail open it.
2. **Use a different provider** (Proton, Fastmail) for admin accounts.
3. **For ops-only access**, bypass the email flow entirely by creating a
   session directly in Postgres:

```bash
DB_URL=$(grep '^DATABASE_URL=' /root/releaselog/.env.local | cut -d= -f2-)
USER_ID=$(psql "$DB_URL" -tAc "select id from users where email='you@example.com'")

node -e '
  const c = require("node:crypto");
  const raw = c.randomBytes(24).toString("base64url");
  const hash = c.createHash("sha256").update(raw).digest("hex");
  console.log(raw);
  console.log(hash);
' | {
  read RAW; read HASH
  psql "$DB_URL" -c "insert into sessions (id, user_id, token_hash, expires_at)
                     values (gen_random_uuid(), '$USER_ID', '$HASH',
                             now() + interval '30 days')"
  echo "Set this cookie in your browser: releaselog_session=$RAW  (domain .releaselog.site, HttpOnly, Secure)"
}
```

---

## Notification pipeline

Release notifications and weekly digests are decoupled from the admin approve
action: approving a candidate only **enqueues** per-recipient rows into
`sent_notifications`; a systemd timer (`releaselog-send.timer`) drives the
actual sending. This keeps the admin UI snappy, gives automatic retry with
exponential backoff, and makes duplicate sends structurally impossible.

### Flow

```
admin /admin/candidates  →  POST /api/admin/candidates/:id/approve
                             └─ createPublishedRelease (DB)
                             └─ enqueueReleaseNotifications → inserts
                                sent_notifications rows with status='pending'
                             └─ HTTP 303 redirect (fast)

releaselog-send.timer (every minute)
  → /api/cron/send-notifications
     └─ runSendWorker: claims batch of pending|failed rows (short tx,
        flips status='sending', pushes next_retry_at +5min as safety net),
        sends mail with concurrency=4, on success sets status='sent',
        on failure sets status='failed', attempts++, next_retry_at exp backoff
        (1,2,4,8,16 min), caps at attempts=5.

releaselog-weekly-digest.timer (Mon 09:00 UTC)
  → /api/cron/weekly-digest
     └─ reserves (user_id, period_start, 'email') in sent_digests before
        sending; duplicate triggers in the same week are idempotent.
```

### systemd inventory

| Unit | Cadence | Endpoint |
|---|---|---|
| `releaselog-ingest.timer` | every 30 min (`*:0/30`) | `/api/cron/ingest` |
| `releaselog-send.timer` | every minute (`*:*:00`) | `/api/cron/send-notifications` |
| `releaselog-weekly-digest.timer` | Mon 09:00 UTC | `/api/cron/weekly-digest` |

Source units live in `deploy/`; `deploy/call-cron.sh` sources `.env.local`
and curls localhost with `Authorization: Bearer $CRON_SECRET`.

### One-time install

```bash
cd /root/releaselog
sudo cp deploy/releaselog-ingest.service         /etc/systemd/system/
sudo cp deploy/releaselog-ingest.timer           /etc/systemd/system/
sudo cp deploy/releaselog-send.service           /etc/systemd/system/
sudo cp deploy/releaselog-send.timer             /etc/systemd/system/
sudo cp deploy/releaselog-weekly-digest.service  /etc/systemd/system/
sudo cp deploy/releaselog-weekly-digest.timer    /etc/systemd/system/
sudo chmod 0750 /root/releaselog/deploy/call-cron.sh
sudo systemctl daemon-reload
sudo systemctl enable --now \
  releaselog-ingest.timer \
  releaselog-send.timer \
  releaselog-weekly-digest.timer
systemctl list-timers --all | grep releaselog   # expect three rows
```

### Manual triggers (debugging)

```bash
sudo systemctl start releaselog-ingest.service
sudo systemctl start releaselog-send.service
sudo systemctl start releaselog-weekly-digest.service

# Or direct curl (identical effect):
curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/ingest
curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/send-notifications
curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/weekly-digest

# Tail the latest run of any:
sudo journalctl -u releaselog-send.service -n 50 --no-pager
```

### Observability queries

```bash
DB_URL=$(grep '^DATABASE_URL=' /root/releaselog/.env.local | cut -d= -f2-)

# Queue depth by status
psql "$DB_URL" -c "select status, count(*) from sent_notifications
                   group by status order by 1;"

# Retry-scheduled rows (waiting out the backoff)
psql "$DB_URL" -c "select id, user_id, attempts, next_retry_at, error
                   from sent_notifications
                   where status='failed' and attempts < 5
                   order by next_retry_at asc limit 20;"

# Permanently failed (attempts hit cap of 5) — needs human review
psql "$DB_URL" -c "select user_id, release_id, attempts, error, updated_at
                   from sent_notifications
                   where status='failed' and attempts >= 5
                   order by updated_at desc;"

# Sent in the last 24h
psql "$DB_URL" -c "select count(*) from sent_notifications
                   where status='sent' and updated_at > now() - interval '1 day';"

# Digests dispatched this week
psql "$DB_URL" -c "select count(*) from sent_digests
                   where period_start = (current_date - ((extract(dow from current_date)::int + 6) % 7))::date;"
```

### Unsubscribe

Outbound release emails include RFC 8058 `List-Unsubscribe` +
`List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers and a visible
unsubscribe link in the body. The token is an HMAC over `userId:target`
signed with `PRIVATE_FEED_SIGNING_SECRET` (no DB row needed).

- `target=<entityId>` → removes that entity from the user's
  `selected_entity_ids`.
- `target=all` → sets `email_enabled=false`.

`/api/unsubscribe` handles both GET (human click) and POST (Gmail/Yahoo
one-click). Note Gmail only surfaces the one-click UI when DKIM and SPF
align — that's a DNS concern, not a code concern.

### Common failure modes (notification pipeline)

| Symptom | Likely cause | Check / fix |
|---|---|---|
| Approve returns 409 `already_approved` | The same candidate has already been approved into a different release (rename on second approve) | Look up the first approve: `select id, title from published_releases where source_candidate_id='<cand>';`. Edit the existing release or reject the candidate. |
| Rows stuck in `pending` | Send worker timer not running or `/api/cron/send-notifications` returning non-200 | `systemctl status releaselog-send.timer`; `journalctl -u releaselog-send.service -n 50`; curl the endpoint manually to see the JSON response |
| `attempts >= 5` pileup | Bad provider credentials, DNS failure on from-domain, etc. Errors in `error` column | Fix the underlying issue, then retry the cap-hit rows: `update sent_notifications set status='pending', attempts=0, next_retry_at=now(), error=null where status='failed' and attempts >= 5;` |
| Weekly digest missed | Timer inactive, or `periodStart` already reserved from a prior run | `systemctl list-timers releaselog-weekly-digest.timer`; if the reservation is stale: `delete from sent_digests where period_start=<YYYY-MM-DD>;` then retrigger |
| User got zero emails for a release they care about | Filter: `isSubscriptionActive(status) && emailEnabled && selectedEntityIds.includes(entityId)` all required | `select s.status, p.email_enabled, p.selected_entity_ids from users u join subscriptions s on s.user_id=u.id join notification_preferences p on p.user_id=u.id where u.email='...';` |

**Note:** `notification_preferences.last_emailed_release_at` is a vestigial
column (no current reader). Safe to ignore in queries; drop in a future
schema cleanup.

---

## Data ingestion (release entries)

Entity JSON files live in `data/entities/*.json`; the registry is
`data/entity-registry.json`. Schema is in `data/types.ts`; the validator is
`scripts/validate-data.cjs` and runs as part of `npm run prebuild`.

### Quick path: a single new release

1. Edit the relevant entity file — append an object to `releases[]` with a
   globally unique `id`, `date` (YYYY-MM-DD), and `title` (minimum schema).
2. `npm run validate` — catches schema and duplicate-id errors before prod.
3. Optionally bump the entity's `subtitle` / `footnote` to reflect the new
   "as-of" date.
4. `git add`, `git commit`, then rebuild and restart (see below).

For larger refresh passes (multiple entities at once), the admin candidates
flow at `/admin/candidates` lets a logged-in admin approve/reject items
queued by `/api/cron/ingest`. `ADMIN_EMAILS` in `.env.local` controls who
has admin access.

---

## SOP: refreshing team release histories

Use this when a team's history feels thin, when the last 3 months are
under-represented, or when a major model / event needs to be added across
several entities. This is the recurring "pull in new info" workflow.

### 0. Pick today's "as-of" date

Pick a single ISO date and use it consistently in every `subtitle` /
`footnote` you touch (e.g. `Cross-checked on 2026-05-09 against …`). The
homepage and per-entity pages use these strings for the freshness signal.

### 1. Sources to consult per entity

Always cross-check against the **brandUrl** of the entity first. Acceptable
sources are listed below. If a fact only shows up on a marketing tweet or a
secondary blog, **don't add it** — the dataset's value is that every row
links back to a primary source.

| Entity (`id`) | Primary sources |
|---|---|
| `anthropic-team` | `anthropic.com/news`, `claude.com/blog`, `support.claude.com/.../release-notes` |
| `api-team` (Claude API) | `platform.claude.com/docs/en/release-notes/overview`, model docs, beta header docs |
| `claude-product` | `support.claude.com/.../release-notes`, `claude.com/blog` |
| `openai-team` | `openai.com/news`, `help.openai.com/.../release-notes`, `platform.openai.com/docs` |
| `deepseek-team` | `api-docs.deepseek.com/updates`, `huggingface.co/deepseek-ai`, `platform.deepseek.com` |
| `google-deepmind-team` | `deepmind.google/blog`, `ai.google.dev/.../release-notes`, `cloud.google.com/.../release-notes`, `blog.google` |
| `xai-team` | `docs.x.ai/developers/release-notes`, `x.ai/news`, `x.ai/blog` |
| `mistral-team` | `mistral.ai/news`, `docs.mistral.ai/resources/changelogs`, `events.mistralai.com` |
| `vllm-team` | `github.com/vllm-project/vllm/releases`, `docs.vllm.ai`, `blog.vllm.ai` |
| `ai-events` | The official event page only (e.g. `io.google/2026/`, `nvidia.com/gtc`, `aws.amazon.com/events/reinvent`) |

### 2. Coverage targets

For a healthy entity, aim for:

- **≥ 20 total releases** in the visible window.
- **≥ 10 entries** in the past 3 months (this drives the homepage density and
  the "recent activity" signal).
- **At least one** `kind: "event"` per quarter for team entities that host
  developer events (Anthropic, OpenAI, Google, Mistral, NVIDIA-adjacent).

### 3. Entry conventions

Required: `id`, `date`, `title`. Strongly recommended for new rows:

- `shortTitle` — under ~24 chars; used in dense list views.
- `description` — 1–3 sentences. Lead with the fact; include the model name,
  endpoint, beta header, region, or pricing number when relevant.
- `sourceUrl` — primary source from the table above.
- `importance` — `1` (minor patch / small UI), `2` (notable feature /
  partner), `3` (model launch / GA / acquisition / flagship event).
- `audience` — one of `end_user`, `developer`, `admin`, `partner`, or an
  array. For dev-facing API rows use `"developer"`; for admin/governance use
  `["admin","partner"]`.
- `status` — `stable | preview | beta | deprecated`. Use `deprecated` for
  retirement / sunset announcements; this also controls the badge style.
- `tags` — short, lowercase, hyphenated; reuse existing tags where possible
  (`model`, `api`, `agents`, `enterprise`, `governance`, `mcp`, `pricing`,
  `claude-code`, `codex`, `gemini`, `gemma`, `event`, …).
- `kind: "event"` — for conferences / livestreams / community days.
  Otherwise omit (defaults to `"release"`).

ID format: namespace by entity, then date and a slug, e.g.
`openai-2026-04-codex-jetbrains`, `vllm-2026-05-v0202`,
`api-2026-05-managed-agents-ga`. **Globally unique.** The validator will
reject duplicates across the whole dataset.

### 4. Validate, regenerate, sanity-check

```bash
cd /root/releaselog

# 1. Schema + global-uniqueness check
npm run validate
# expect: validate-data: OK (10 entities, NNN releases)

# 2. Regenerate the bundles consumed by the client
node scripts/gen-static-data.mjs
# updates: data/entity-metas.json
#          public/data/<entityId>-releases.json (one per entity)

# 3. TypeScript sanity (entity JSONs are type-checked at build time)
npx tsc --noEmit

# 4. (Optional) per-entity counts and recent-window density
for f in data/entities/*.json; do
  total=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$f','utf8')).releases.length)")
  recent=$(node -e "
    const r = JSON.parse(require('fs').readFileSync('$f','utf8')).releases;
    const cutoff = new Date(Date.now() - 90*86400e3).toISOString().slice(0,10);
    console.log(r.filter(x => x.date >= cutoff).length);
  ")
  printf '%2d total / %2d last-90d  %s\n' "$total" "$recent" "$(basename $f .json)"
done
```

### 5. Ship it

```bash
git add data/entities/ data/entity-metas.json public/data/*-releases.json RUNBOOK.md
git commit -m "Refresh team release histories (as of YYYY-MM-DD)"
git push origin main

# Rebuild + restart
npm run build && sudo systemctl restart releaselog.service

# Verify the deploy is live
curl -sS -o /dev/null -w "root %{http_code}\n" https://releaselog.site/
curl -sS https://releaselog.site/data/anthropic-team-releases.json \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>console.log('anthropic releases:', JSON.parse(d).length))"
```

`npm run prebuild` re-runs `validate` and `gen-static-data` automatically,
so a build will fail loudly if the JSON is broken — safe to retry without
taking the service down.

### 6. What NOT to do

- **Don't invent dates or facts.** Every row should be defensible from its
  `sourceUrl`. If a launch is rumored but not on the official source, leave
  it out.
- **Don't reuse IDs.** The validator rejects duplicates; the rejection
  applies across all entities, not just the one you edited.
- **Don't reformat existing entries** in the same commit as additions —
  noisy diffs make review hard. If you must reformat, do it in a separate
  commit.
- **Don't edit `data/entity-metas.json` or `public/data/*-releases.json` by
  hand.** They are regenerated from `data/entities/*.json` by
  `scripts/gen-static-data.mjs` (which also runs as part of `npm run dev` /
  `npm run build`).

---

## i18n (site chrome)

The site UI (nav, controls, headings, footer) is translated via a small
in-house framework — release/event content stays in its original language.

### Files

| Piece | Where |
|---|---|
| Translations | `messages/<locale>.json` (one file per locale) |
| Server helpers | `lib/i18n.ts` (`getLocale`, `getServerTranslator`, `makeTranslator`) |
| React Context | `components/I18nProvider.tsx` (`useT()`, `useLocale()`) |
| Picker UI | `components/LanguageSwitcher.tsx` (mounted in `Header.tsx` and `app/reset-log/ResetLogList.tsx`) |
| Cookie | `releaselog_locale` (1 year, `Path=/`, `SameSite=Lax`) |

Locale detection on every request: `releaselog_locale` cookie →
`DEFAULT_LOCALE` (`en`). `Accept-Language` is intentionally **not**
sniffed — every new visitor lands on the English version, and switches
locale by clicking the picker (which sets the cookie for 1 year).

### Adding strings

1. Add the key to **every** `messages/<locale>.json` file under a logical
   namespace (`nav.*`, `switcher.*`, `reset_log.*`, etc.). Keys missing from
   a locale fall back to the literal key string at runtime.
2. Reference it:
   - **Client component** (`"use client"`):
     `import { useT } from "@/components/I18nProvider";`
     `const t = useT(); … {t("namespace.key", { name: foo })}`
   - **Server component** (no `"use client"`):
     `import { getServerTranslator } from "@/lib/i18n";`
     `const { t } = await getServerTranslator(); … t("namespace.key")`
3. Interpolation uses `{name}`, `{days}`, etc. — see `headline.default`.

### Adding a language

1. `cp messages/en.json messages/<code>.json` and translate the values.
2. In `lib/i18n.ts`:
   - Append the code to `SUPPORTED_LOCALES`.
   - Import the file and add it to the `MESSAGES` map.
   - Extend `pickFromAcceptLanguage` if the BCP-47 tag isn't `en` / `zh`.
3. In `components/LanguageSwitcher.tsx`, add the code/label/aria entry.
4. Rebuild + restart.

### What's translated and what isn't

- **Translated**: site chrome (nav, switcher labels, range/poster controls,
  stats labels, footer, weekday letters, reset-log page chrome and per-event
  page section headings, `<title>` and `<meta description>` of `/reset-log`).
- **Not translated** (intentional): release entry titles/descriptions/tags,
  team and entity names, `data/reset-log.ts` event titles/summaries, dates
  (`MMM d, yyyy`-formatted in English), `<title>` and `<meta>` of per-entity
  pages (those reflect the entity's English brand line).

### Notes on rendering

Reading `cookies()` in the root layout opts every page out of static
generation. `app/reset-log/[slug]` previously had `export const dynamic =
"force-static"`; that was removed when `ResetLogList` became `async`.
`generateStaticParams` is still used to enumerate valid slugs and 404
unknown ones (`dynamicParams = false`). For a small site this trade-off is
fine; if the dynamic-render cost ever becomes a problem, switch the slug
page to render its own (non-i18n) version of the listing inline.

`STATIC_EXPORT=1 next build` (`npm run build:pages`) still works:
`getLocale()` is wrapped in try/catch and silently returns `DEFAULT_LOCALE`
when there is no request context.

### Quick check

```bash
# EN (default) — should contain English chrome strings
curl -sS https://releaselog.site/ | grep -oE '(<html lang="[a-z]+"|Pricing|Subscribe|Range)' | sort -u

# ZH — set the cookie and re-fetch
curl -sS -H 'Cookie: releaselog_locale=zh' https://releaselog.site/ \
  | grep -oE '(<html lang="[a-z]+"|定价|订阅|时间范围)' | sort -u

# /reset-log title localizes
curl -sS https://releaselog.site/reset-log | grep -oE '<title>[^<]+</title>'
curl -sS -H 'Cookie: releaselog_locale=zh' https://releaselog.site/reset-log \
  | grep -oE '<title>[^<]+</title>'
```

---

## Common failure modes

| Symptom | Likely cause | Check |
|---|---|---|
| Stripe webhook deliveries fail with 503 | Env not loaded; `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` missing | Restart the service. Probe the endpoint — 400 = good, 503 = env missing. |
| Stripe test-mode webhook retries fail after going live | Production only has the live webhook signing secret, but the test-mode endpoint signs with its own secret | Set `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET`, then rebuild/restart and resend a test event. |
| "No such price: …; a similar object exists in live mode, but a test mode key was used" | `STRIPE_PRICE_PRO_*` is from the other mode than the active secret key | Re-copy the Price IDs from the Dashboard with the correct mode toggle. |
| `current_period_end` is NULL in `subscriptions` | Reading the wrong field on newer Stripe API versions | Confirm `lib/billing.ts` reads `subscription.items.data[*].current_period_end` (fixed in commit `6bc2028`). Rebuild if you changed code. |
| Magic-link always shows `invalid_token` | Gmail prefetched and consumed the token | Use the Copy-Link-Address workaround or the direct-session bypass above. |
| Webhook endpoint URL shown as `https://releaselog.site` (no path) in Dashboard | Someone forgot the path when creating the endpoint | Edit the endpoint and append `/api/webhooks/stripe` — signing secret is preserved. |
| Checkout redirects show preview/success but no DB row | `syncCheckoutSession` is running but `customer.subscription.*` events aren't being forwarded | Verify all four event types are enabled on the webhook endpoint. |

---

## Health-check recipes

Copy-pasteable probes for quick diagnosis:

```bash
# App is up and serving
curl -sS -o /dev/null -w "root %{http_code}\n" https://releaselog.site/

# Stripe env is loaded (400 = loaded, 503 = not)
curl -sS -o /dev/null -w "webhook %{http_code}\n" \
  -X POST -H "stripe-signature: fake" --data '{}' \
  https://releaselog.site/api/webhooks/stripe

# Cloudflared tunnel is up
systemctl is-active cloudflared-releaselog.service

# Notification timers
systemctl list-timers --all | grep releaselog

# Send-worker endpoint loaded (200 on valid auth, 401 without)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/send-notifications | jq .

# Unsubscribe endpoint loaded (400 on bogus token = route is live)
curl -is "http://127.0.0.1:3000/api/unsubscribe?token=invalid" | head -1

# Database reachable
DB_URL=$(grep '^DATABASE_URL=' /root/releaselog/.env.local | cut -d= -f2-)
psql "$DB_URL" -c "select 1"

# Most recent subscriptions (sanity-check webhook pipeline)
psql "$DB_URL" -c "select u.email, s.status, s.current_period_end, s.updated_at
                   from subscriptions s join users u on u.id = s.user_id
                   order by s.updated_at desc limit 5"

# Notification queue status
psql "$DB_URL" -c "select status, count(*) from sent_notifications
                   group by status order by 1"
```

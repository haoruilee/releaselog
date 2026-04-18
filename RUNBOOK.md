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

Keep the test values somewhere (a comment in a scratch file) — you'll want
them when debugging new code in test mode again.

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
`data/entity-registry.json`. Adding a new release:

1. Edit the relevant entity file — append a new object to `releases[]` with a
   unique `id`, `date` (YYYY-MM-DD), and `title` (minimum schema).
2. `npm run validate` — catches schema errors before they hit prod.
3. Optionally update the entity's `subtitle` / `footnote` to reflect the new
   latest date.
4. `git commit` and `npm run build && sudo systemctl restart releaselog.service`.

For larger refresh passes (multiple entities at once), the admin candidates
flow at `/admin/candidates` lets a logged-in admin approve/reject items
queued by `/api/cron/ingest`. `ADMIN_EMAILS` in `.env.local` controls who
has admin access.

---

## Common failure modes

| Symptom | Likely cause | Check |
|---|---|---|
| Stripe webhook deliveries fail with 503 | Env not loaded; `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` missing | Restart the service. Probe the endpoint — 400 = good, 503 = env missing. |
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

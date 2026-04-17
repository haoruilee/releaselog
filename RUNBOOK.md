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

# Database reachable
DB_URL=$(grep '^DATABASE_URL=' /root/releaselog/.env.local | cut -d= -f2-)
psql "$DB_URL" -c "select 1"

# Most recent subscriptions (sanity-check webhook pipeline)
psql "$DB_URL" -c "select u.email, s.status, s.current_period_end, s.updated_at
                   from subscriptions s join users u on u.id = s.user_id
                   order by s.updated_at desc limit 5"
```

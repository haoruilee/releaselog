# ReleaseLog site refresh — 2026-11-03

Reset Log previously rendered a static list whose newest record was May 15.
It now reads a central server feed used by lists, categories, detail pages and
sitemap. Eight public third-party archives provide discovery; original staff
post links establish attribution. Canonical post IDs deduplicate records and
preserve existing slugs. Banked reset credits, automatic resets, limit changes
and effective dates are distinguished. Source-linked entries do not guarantee
an individual account received a reset. Future predictions are excluded.

Public discovery uses a one-hour Next fetch cache and bounded timeouts, without
paid LLM calls. Cached fetches and verified historical seeds keep pages usable
during source outages. This is request-driven cache refresh, not a guaranteed
background fetch at each clock hour. The live production warmup exposed 105
distinct category/detail links, including 91 source-ID-linked current/imported
details. Source provenance is explained at `/sources`.

Advertising positions are available across release calendars, Reset Log and
editorial footers. `/advertise` describes placements; `/admin/advertising` is
protected by existing admin authentication. Unconfigured sites show labeled
sponsor invitations and make no ad-network requests. Valid runtime publisher
and slot settings enable AdSense; a valid publisher produces `/ads.txt`.
Direct sponsorship accepts only HTTPS destinations. Export helpers exclude
ad placements. No publisher ID, advertiser, traffic claim or revenue claim was
fabricated; Google approval and actual paid delivery remain untested.

## Verification and immutable release

- Builds ran exclusively on `li@www.xzhtai.cn:2077`, isolated directory
  `/home/li/releaselog-site-refresh-20261103/source`, with a complete 181-file
  input manifest. No runtime secrets, production SQL/Redis or provider
  credentials were present in build/test resources.
- 14 parser/advertising tests and 17 autonomy tests passed, followed by the full
  Next production compile, type checks and static-page generation.
- Playwright on the builder passed 28 page cases across EN/ZH and desktop/mobile,
  checking layout overflow, new detail links, sources, placeholders, admin
  guard and absence of ad-vendor requests. A separate old detail URL returned 200.
- Builder tag: `releaselog/app:site-refresh-20261103-r4`.
  Builder image ID:
  `sha256:1abff217c215262efd372ea3513e02c1b6bee0ed6f4d5b3fca212a08c7e43a3c`.
- Materialized archive SHA256:
  `b2b1b58e0d9536a41c7f330bbddc438b89e689081921e169170d0bf974bc3998`.
  Transfer used resumable rsync. Loaded architecture, OS, full RootFS layer list
  and runtime Config matched the builder exactly; image-store IDs differ.
- Green was warmed before a guarded root-CNAME switch. Other 21 DNS records and
  the shared Cloudflare service/config were unchanged. Public HTTP checks cover
  homepage, Reset Log, advertising, sources, login, pricing, entity API, Atom,
  sitemap and an old detail URL. The private acceptance folder retains receipts.
- A private pg_dump custom-format backup was created and its catalog parsed.
  No database migration or restore was performed. Old app/worker control plane
  remains active; green handles public traffic. Do not assume ordinary Compose
  `up` will reproduce this blue/green topology; consult the current runbook.

## Automated reviews and provider

The hourly reviewer now makes terminal approve/reject decisions rather than
repeating editorial human holds. Approvals still require evidence and confidence
at least 0.85; ambiguous or unsupported items are rejected, not force-published.
Unchanged blocked/failed batches cool down for 24 hours. Release-only CLI tools
are limited to reading evidence and writing its validated outbox.

The accepted live round `4e0213f3-43a7-439a-999d-7139ff0ba4d8` applied eight
rejections, zero approvals and zero human holds; these were not eight published
articles. Native Claude Code uses the exact AIPing model
`GLM-5.3:provider=内部算力-HG-GLM-5.3-1`, and its task was gracefully restarted.
A real supplier request returned that exact model and `DISCOUNT_ROUTE_OK`:
Request-Id `ff8baa96-5cf0-40d3-9de1-b720894729bd`. The provider-routing response
was verified; the supplier's final monetary discount was not audited.

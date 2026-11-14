# Rolling news queue operations

Effective 2026-11-14. The automated queue is for announcements from the last seven
rolling days; historical backfill is now a separate, explicitly requested operation.
A rejected candidate is retained with its source text and reason. Rejection here means
ineligible for this news queue, not a finding that the source claim is false.

The first sweep reduced 2,251 pending candidates to 17 in about ten seconds. It rejected
2,221 candidates that had waited over seven days, ten newly fetched announcements outside
the seven-day window, one unverified future announcement date, one superseded pending
snapshot, and one already published item. All 783 existing database publication records
retained their IDs, titles, dates, source URLs and publication timestamps. There was no
publication deletion, database restore, container replacement or shared tunnel restart.

## Installed jobs

- `releaselog-queue-maintenance.timer`: every fifteen minutes; deterministic retention
  and duplicate checks, no model call. The service skips while a review is running.
- `releaselog-ai-review.timer`: hourly, at minute zero, with the existing eight-candidate
  batch limit. The fast review timer remains disabled. Empty eligible queues exit before
  starting a model session. Model routing remains the existing AIPing GLM-5.3 route.
- The review service requires the maintenance service to finish first. Systemd ordering
  and an exclusive maintenance lock prevent overlapping sweeps or sweep/review mutations.
- Each review receives recent database publications for relevant entities, so the model
  can detect duplicates without relying on an old static seed file or project memories.
- A deterministic output gate converts approvals with missing/invalid dates, old dates,
  or unverified future dates to rejection. Official scheduled-event dates are exempt from
  the future-date rule; pending age still expires after seven days.

## Rule limits

Dedicated article URLs may match a prior publication after stripping known tracking
parameters. Meaningful query parameters are preserved. Aggregate changelog/release-note
URLs alone are insufficient to identify a duplicate: event date and normalized title
must also match. When an article has no date field, only an explicit Published date header near its
start may establish age; related links and update notices do not count. Generic news
index page changes and explicit IPO-financing notices are rejected as non-releases.
Other unknown-date recent candidates remain eligible for model review, but
publication requires a verified date. Future parsed dates require corrected source data
unless the candidate belongs to the scheduled-event calendar. Within a duplicate pending
snapshot group the newest candidate is kept. These rules do not claim semantic detection
of every duplicate; model review remains necessary for the recent queue.

## Evidence and recovery

The maintenance process reads a repeatable snapshot and uses only `action=reject` through
the existing authenticated loopback review API. It does not run SQL mutation commands.
Each batch is at most fifty decisions. A failed request is not retried automatically
within that sweep; partial receipts persist, and the next sweep reads terminal database
state afresh. Unexpected approvals, skips or count mismatches fail acceptance.

Private snapshots, per-candidate plans, API run IDs and completion receipts are stored in
`/root/releaselog/var/queue-maintenance/`. Snapshots are mode 0600 in a mode-0700 directory.
Sweeps with no rejections only refresh `last-sweep.json` and journal status; they do
not create repeated snapshot/plan/result files. `last-sweep.json` supplies the
recent-publication context. Initial acceptance and original
runtime files are also retained under `/root/ops-private/releaselog-backlog-20261114/`.
Restore a mistaken rejection only by its exact candidate ID after reviewing its snapshot;
never restore the whole database or erase later review decisions to undo queue cleanup.

Code/config rollback: wait for an active review to finish, stop the two affected timers,
restore `scripts/ai-harness.mjs`, `scripts/ai-autonomy.mjs` and the old review timer from
that private runtime backup, remove the `30-queue-maintenance.conf` drop-in, reload systemd
and re-enable the prior review timer. Keep the queue backup and rejection reasons. A code
rollback does not reopen expired candidates and does not alter published records.

## Validation

Forty-five pure JavaScript tests passed on the designated builder `li@www.xzhtai.cn:2077` from
eight hash-verified, allowlisted inputs with synthetic fixtures only. They cover freshness
boundaries, missing and invalid dates, scheduled events, meaningful URL parameters,
aggregate-page safety, published and pending duplicates, fifty-item rejection batches,
partial failure without POST retries, reject-only authority, and existing harness gates.
The actual installed systemd sandbox completed the first sweep successfully. Source and
unit hashes, snapshots and HTTP acceptance are retained in the private release evidence.

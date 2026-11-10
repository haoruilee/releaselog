# Original project field notes — 2026-11-10

Four original ReleaseLog field notes extend the three existing developer guides. Their
bodies contain 516, 529, 514 and 533 words. They cover candidate/publication boundaries,
reset-event dates and stable identity, the prior raw-marker counting and handoff
sequencing mistake, and the limits of static-asset rollback checks. Each links to pinned
project code or an acceptance record and a published controlled-check snapshot:

- https://releaselog.site/guides/collected-is-not-published
- https://releaselog.site/guides/event-dates-and-stable-identity
- https://releaselog.site/guides/count-rendered-cards-not-html-markers
- https://releaselog.site/guides/what-static-asset-rollback-proves
- https://releaselog.site/research/editorial-field-checks-20261110.json

A native Claude Code run used the owner-selected AIPing GLM-5.3 route to draft the
articles. A separate parent AI review checked and revised them against the actual code,
prior acceptance record and controlled results. Raw model output was retained separately
and was not published directly. No human expert review, benchmark, author credentials
or AdSense approval is claimed. Review corrected collection/review/application boundaries,
score interpretation, merge-order scope, the previous handoff chronology, parsed versus
hydrated documents, and distinctions between asset availability, traffic and database recovery.

Evidence comes from five actual normalizer cases, six synthetic parser cases, a controlled
HTML fixture and separately collected pre-batch public snapshot, and a small three-case
asset-merge reproduction. The runner executed only on the designated builder with no model,
SQL or upstream credentials. Its SHA256 is published with outcomes and scope limits.
The six-markers/three-nodes snapshot predates this batch; the current index has seven cards.
These fixtures do not establish upstream factual accuracy, all browser compatibility,
universal deduplication, image provenance, or database rollback safety.

The index labels field notes separately from vendor guides. Evidence cards derive values
from the published JSON. The homepage links directly to the four notes; article metadata,
sitemap, cross-links and correction contact remain available. Full article bodies stay
out of the homepage client bundle, which imports only small featured-title metadata.

Build source: `579c90aa6ad79829426898ff2d86385794467412`.
Image: `releaselog/app:field-notes-20261110-579c90a`.
Builder image ID: `sha256:c2d65804a9ad54e24654f0ef2410e5f8156e6762c94b166f7da77daee94d9970`.
All compilation ran on `li@www.xzhtai.cn:2077` from 199 hash-verified allowlisted inputs.
No runtime secrets or production state entered the context or synthetic tests. The exact
builder image was distributed as a checksummed delta with nine byte-identical cached base
layers. Loaded OS, architecture, full RootFS, runtime Config and source label matched;
the final-image browser receipt is pinned to that builder image and source revision.

Validation: 33 deterministic tests, content/schema/source/date/hash checks, Next production
compile/type checks, six isolated browser cases (EN/ZH, 390/768/1536px, 42 article visits),
25 candidate HTTP routes, six public browser cases (another 42 article visits), and
25 public HTTP routes. All passed. Shared tunnel and background-service identities
matched the pre-release record, and the retained old application passed its health check.
Browser checks cover navigation, all seven articles, evidence cards, source links, canonical
and Article metadata, anchors, sitemap, unknown-route 404, calculator interactions/invalid
inputs, overflow, page errors and static assets. Google vendor requests were intercepted;
no ads were clicked or paid generation probes submitted. Authoring itself used the model.

Dedicated public tunnel handoff moved traffic from port 3005 to 3006 after candidate,
browser and provenance receipts passed. The switch script also checks intended source
revision and image agreement. An initial preflight attempt rejected a local HTTP-status
assertion typo before any configuration writes; it was corrected without bypassing gates.
Five homepage probes during the actual handoff succeeded. This is a bounded observation.

Public app: `releaselog-app-field-notes-20261110`, loopback port 3006. Old public app on
3005 remains healthy. Verify its localhost health, then traffic rollback is available via:
`python3 /root/ops-private/releaselog-field-notes-20261110/switch-public.py 3005`.
Database restoration is separate. Shared tunnels, DNS, control app, DB, workers, review
timers and advertising/CMP account settings were not changed by this content release.
Private receipts: `/root/ops-private/releaselog-field-notes-20261110/`.

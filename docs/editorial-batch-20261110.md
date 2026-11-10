# ReleaseLog editorial batch — 2026-11-10

Three English operational guides were drafted with the owner-selected AIPing GLM-5.3
route through a separate Claude Code tmux session, then revised by an independent
parent AI review against six linked primary documents. The initial audit was a limited
review of app routes and provided code facts, not a comprehensive content/SEO audit or
an AdSense approval prediction. No human expertise, field test or benchmark is claimed.

Published routes:
- https://releaselog.site/guides
- https://releaselog.site/guides/claude-prompt-cache-boundaries
- https://releaselog.site/guides/claude-code-hooks-before-and-after
- https://releaselog.site/guides/vllm-prefix-cache-workload-fit

The accepted guide bodies contain 575, 563 and 576 words. Facts, editorial analysis,
hypothetical examples and checklists are separately labeled. Source-check dates are
editorial review dates, not feature release dates. The cache guide adds a browser-only
input-token ledger with explicit hypothetical values; it sends no model request and
calculates neither prices nor speedups. Authorship/method and correction contact are
available from the guide index. Article schema, canonical URLs, related calendars,
header/footer and homepage entry points make the pages discoverable without duplicating
release records or altering the existing API/feed pipeline.

Review corrections covered cache prefix hierarchy and eligibility, freshness assumptions,
request-level controls, pre-action prevention versus post-action repair, command-hook
scope, asynchronous mutation races, block eviction rather than API TTL assumptions,
and distinguishing prefill opportunity from end-to-end performance. Primary documents:
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching
- https://code.claude.com/docs/en/hooks-guide
- https://code.claude.com/docs/en/hooks
- https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/
- https://docs.vllm.ai/en/latest/design/prefix_caching/

Build source revision: `6d88621`. Immutable image:
`releaselog/app:editorial-20261110-6d88621`. Builder image ID:
`sha256:0dd99a56c02d1a2781407bee2039b9b6af0d60ba072b82643500b6a337900860`.
All compilation ran on li@www.xzhtai.cn:2077, using 196 hash-verified allowlisted inputs.
No private runtime state or credentials entered the Docker context or synthetic tests.
The image was transferred as a checksummed delta against nine byte-identical cached
base layers and reconstructed without compilation. Loaded OS, architecture, full RootFS
and runtime Config match the builder. Full immutable archive remains on the builder.

Validation: 33 deterministic tests, editorial source/schema/date checks, Next production
compile/type checks, six isolated browser cases and six public browser cases (EN/ZH,
390/768/1536px; 18 guide visits each). Checks include navigation, anchors, source links,
canonical/Article metadata, sitemap, counter updates and invalid inputs, no overflow,
no page errors, and no broken static assets. Google vendor scripts were intercepted in
browser QA; no ads were clicked or paid model tests triggered. The authoring run itself
used the authorized model. Twenty candidate HTTP routes and nineteen public routes passed.

Operational validation note: the first candidate script counted raw marker strings,
including Next serialized component data. The outer shell did not stop after that
instrumentation failure and began handoff before the complete candidate HTTP gate
finished. A parsed-HTML check subsequently passed all twenty routes. The handoff recorded
five successful public probes with no failures. Switch scripts now require candidate,
synthetic-browser and provenance acceptance receipts. This sequencing error is retained
in the private validation note rather than described as a fully ordered pre-cutover gate.

Public container: releaselog-app-editorial-20261110 on 127.0.0.1:3005.
Old public container on port 3004 remains running. Rollback after checking its health:
`python3 /root/ops-private/releaselog-editorial-20261110/switch-public.py 3004`.
Shared tunnels, DNS, SQL schema, control app and workers were unchanged. Advertising
account, automatic-ad and CMP settings were not changed. This is a one-off reviewed
batch, not an automatic editorial publication timer. Evidence and source-review receipts
are private under `/root/ops-private/releaselog-editorial-20261110/`.

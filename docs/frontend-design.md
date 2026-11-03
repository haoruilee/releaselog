# ReleaseLog frontend design

The 2026-11-03 redesign uses a light editorial reading surface, selected by the
owner. It retains the existing release data, entity routes, account flows and
billing behavior. It does not replace the framework or add UI dependencies.

## Reference and design system

Public Mobbin examples informed toolbar separation, filtering and chronology:

- [Web filtering flows](https://mobbin.com/explore/web/flows/filtering-sorting)
- [Notion filtering and sorting](https://mobbin.com/explore/flows/36365690-40f3-49f2-a63f-cb7800a73b8c)
- [Web timelines and history](https://mobbin.com/explore/web/screens/timeline-history)

These are pattern references, not assets embedded in the app. Mobbin's paid
library/MCP was not connected. Four generated concept screens established the
calendar, Reset Log, pricing and login families. Actual source links, dates,
event classifications, prices and account-dependent CTAs always override
illustrative concept data.

The page background is true white; text is ink `#191b20`, secondary text
`#62666f`, borders `#e5e7eb`, quiet surfaces `#f7f8fa` and the brand accent
`#c2410c`. Instrument Serif supplies editorial headings; DM Sans supplies body
and controls. Shared semantic Tailwind colors include working opacity variants.
Feed-specific link accents are darkened when needed for normal-text contrast
on white, while reading surfaces stay light.

The shared header/footer owns navigation and language selection. Main content
uses a 1344px maximum wrapper with 48px desktop / 24px mobile inner gutters.
Compact month grids sit side by side on desktop. Mobile filters wrap cleanly,
and the Reset Log calendar can be expanded without delaying the record list.
Timeline rows use a date column, restrained agent/type labels, a summary and
traceable source links. Real details remain on their stable URLs and sitemap.

## Practices to preserve

- Keep interactive components small. Public-source discovery stays on the server;
  timeline search and progressive 20-record loading run locally without model
  calls. Source announcement language remains unchanged; chrome supports EN/ZH.
- Cancel obsolete calendar fetches on team changes and show explicit loading,
  error and retry states. Loading statistics use an em dash instead of a false
  zero. Team, range, date selection and recent-release rows must work with real
  state, not decorative controls.
- Use visible keyboard focus and meaningful labels. The native details dialog
  supports Escape, Tab cycling and focus return. Mobile navigation supports
  Escape and closes after navigation. Respect reduced-motion preferences.
- Preserve PNG exports. Navigation and ads are excluded; poster mode suppresses
  global chrome. Configured ad units reserve space before network rendering;
  no ad network loads when a valid publisher ID is absent.
- Verify real rendered pages at desktop and phone sizes, including keyboard,
  search/no-results, delayed requests, request failure/retry and export. Keep
  synthetic fixtures isolated from production credentials and side effects.
- Build immutable artifacts only on the designated builder. Public deployment
  uses a warmed candidate, compatible old static assets and a dedicated tunnel
  connector handoff. Never restart the shared multi-domain tunnel for this app.

Relevant guidance: [WCAG 2.2 focus visibility](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html),
[layout stability](https://web.dev/articles/optimize-cls), and
[Next.js server/client boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components).
These practices are not a claim of a complete accessibility certification or a
measured field-performance score.

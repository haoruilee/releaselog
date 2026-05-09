/**
 * Reset Log — curated, dated record of subscription quota / rate-limit events
 * for the two subscription-based code agents we track:
 *   • Claude Code  (Anthropic — Pro / Max 5x / Max 20x / Team / Enterprise)
 *   • Codex        (OpenAI    — ChatGPT Plus / Pro / Business / Enterprise)
 *
 * Each entry must link to a verifiable official record (vendor announcement,
 * help-center article, changelog entry, or staff post). When the announcement
 * itself isn't archived at a stable vendor URL, the most authoritative
 * still-online artifact is used and `secondarySources` is populated.
 */

export type ResetAgent = "claude-code" | "codex";

export const RESET_AGENT_SLUGS: ResetAgent[] = ["claude-code", "codex"];

export type ResetEventType =
  | "policy_change" // a new quota / rate-limit policy was introduced or changed
  | "manual_reset" // a one-time vendor-granted reset of existing quotas
  | "limit_increase" // limits were raised
  | "limit_decrease" // limits were lowered
  | "schedule_change"; // change to when limits reset (5h, weekly, etc.)

export interface ResetSource {
  label: string;
  url: string;
}

export interface ResetEvent {
  id: string;
  /**
   * Stable, kebab-case URL slug. Each event renders a dedicated static page
   * at /reset-log/{slug} for SEO/GEO. Treat this as immutable once published —
   * changing it breaks inbound links and search-engine cached URLs.
   */
  slug: string;
  /** YYYY-MM-DD — date the change was officially announced (or took effect, when there is no separate announcement). */
  date: string;
  /** YYYY-MM-DD — set when the change takes effect on a different day from the announcement. */
  effectiveDate?: string;
  agent: ResetAgent;
  /** Free-form list of the plans this event applies to. */
  plans: string[];
  type: ResetEventType;
  title: string;
  /** 1–3 sentence summary suitable for the timeline list. */
  summary: string;
  /** Optional bullet list of specific allowances or scoped notes. */
  details?: string[];
  /** The primary "official record" link. Required. */
  source: ResetSource;
  /** Additional corroborating links (staff posts, follow-ups, related help-center pages). */
  secondarySources?: ResetSource[];
}

export const AGENT_LABELS: Record<ResetAgent, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
};

export const AGENT_VENDORS: Record<ResetAgent, string> = {
  "claude-code": "Anthropic",
  codex: "OpenAI",
};

export const RESET_EVENT_TYPE_LABELS: Record<ResetEventType, string> = {
  policy_change: "Policy change",
  manual_reset: "Manual reset",
  limit_increase: "Limit increase",
  limit_decrease: "Limit decrease",
  schedule_change: "Schedule change",
};

/**
 * Curated list. Newest entries first is fine — the page sorts by date
 * descending before rendering, so insertion order doesn't matter.
 */
export const RESET_EVENTS: ResetEvent[] = [
  // ─────────────────────────────────────────── Codex ───────────────────────────────────────────
  {
    id: "cdx-2026-04-28-paid-plan-reset",
    slug: "codex-paid-plans-reset-2026-04-28",
    date: "2026-04-28",
    agent: "codex",
    plans: ["ChatGPT Plus", "ChatGPT Pro", "Business", "Enterprise"],
    type: "manual_reset",
    title: "Codex rate limits reset for paid plans (\"good week\" reset)",
    summary:
      "OpenAI's Tibo Sottiaux posted that Codex rate limits had been reset for all paid plans to \"celebrate a good week\" and let users build more with GPT-5.5. The actual reset turned out to be narrower than the wording — OpenAI Support later confirmed weekly Codex limits were not reset for all accounts.",
    details: [
      "Announcement covered every paid ChatGPT/Codex tier in wording.",
      "Implementation only refreshed eligible quota intervals (often the 5-hour window); weekly limits were not universally reset.",
      "Codex Usage UI did not surface that a special reset had been applied.",
    ],
    source: {
      label: "@thsottiaux on X (Apr 28, 2026)",
      url: "https://x.com/thsottiaux/status/2048997818673537399",
    },
    secondarySources: [
      {
        label: "openai/codex#20395 — reset-scope discussion",
        url: "https://github.com/openai/codex/issues/20395",
      },
      {
        label: "Codex rate card (OpenAI Help Center)",
        url: "https://help.openai.com/en/articles/20001106-codex-rate-card",
      },
    ],
  },
  {
    id: "cdx-2026-04-07-3m-users-reset",
    slug: "codex-3m-weekly-users-milestone-reset-2026-04-07",
    date: "2026-04-07",
    agent: "codex",
    plans: ["ChatGPT Plus", "ChatGPT Pro", "Business", "Enterprise"],
    type: "manual_reset",
    title: "Codex usage limits reset at 3M weekly users milestone",
    summary:
      "OpenAI announced Codex hit 3 million weekly users and reset usage limits to mark the milestone. Sam Altman said the reset would repeat at each additional million weekly users up to 10 million.",
    details: [
      "Reset applied across paid Codex tiers as a one-time growth-milestone refresh.",
      "Future resets committed at 4M, 5M, …, 10M weekly users.",
      "Same day, the ChatGPT-sign-in Codex model lineup was trimmed (April 14 retirements).",
    ],
    source: {
      label: "Codex changelog (developers.openai.com)",
      url: "https://developers.openai.com/codex/changelog",
    },
    secondarySources: [
      {
        label: "@thsottiaux on X — 3M weekly users",
        url: "https://x.com/thsottiaux/status/2041655710346572085",
      },
      {
        label: "@sama on X — reset every additional 1M",
        url: "https://x.com/sama/status/2041658719839383945",
      },
    ],
  },
  {
    id: "cdx-2025-token-rate-card",
    slug: "codex-token-based-rate-card-2025-09-15",
    date: "2025-09-15",
    agent: "codex",
    plans: ["ChatGPT Plus", "ChatGPT Pro", "Business", "Enterprise"],
    type: "policy_change",
    title: "Codex moves to a token-based rate card",
    summary:
      "OpenAI replaced the rough \"per-message\" usage estimates with a token-based rate card: credits are computed against input, cached input, and output tokens. Plan limits now reset on rolling 5-hour and weekly windows priced at the published rates.",
    details: [
      "Plus: 15–80 local Codex messages per 5-hour window (model-dependent).",
      "Pro $100: ~5× Plus on the 5-hour window plus a weekly cap.",
      "Pro $200: ~20× Plus on the 5-hour window plus a higher weekly cap.",
      "Business / Enterprise: no fixed per-seat rate limits — usage scales with credits.",
    ],
    source: {
      label: "Codex rate card (OpenAI Help Center)",
      url: "https://help.openai.com/en/articles/20001106-codex-rate-card",
    },
    secondarySources: [
      {
        label: "Using Codex with your ChatGPT plan",
        url: "https://help.openai.com/en/articles/11369540",
      },
      {
        label: "Codex pricing — developers.openai.com",
        url: "https://developers.openai.com/codex/pricing",
      },
    ],
  },

  // ─────────────────────────────────────── Claude Code ─────────────────────────────────────────
  {
    id: "cc-2026-05-06-5h-doubled",
    slug: "claude-code-5-hour-limits-doubled-2026-05-06",
    date: "2026-05-06",
    agent: "claude-code",
    plans: ["Pro", "Max 5x", "Max 20x", "Team", "Enterprise"],
    type: "limit_increase",
    title: "5-hour limits doubled; peak-hours throttling removed",
    summary:
      "Anthropic doubled Claude Code's 5-hour rolling rate limits for Pro, Max, Team, and seat-based Enterprise plans, and removed the weekday peak-hours limit reduction for Pro and Max. Effective immediately on May 6, 2026.",
    details: [
      "5-hour rolling window: 2× previous allowance for every plan listed.",
      "Peak-hours (5–11 a.m. PT weekdays) limit reduction removed for Pro and Max.",
      "Enabled by new compute capacity, including a SpaceX Colossus 1 deal (>300 MW / 220k+ GPUs).",
    ],
    source: {
      label: "Anthropic — Higher usage limits for Claude (May 6, 2026)",
      url: "https://www.anthropic.com/news/higher-limits-spacex",
    },
    secondarySources: [
      {
        label: "Use Claude Code with your Pro or Max plan",
        url: "https://support.anthropic.com/en/articles/11145838-using-claude-code-with-your-max-plan",
      },
    ],
  },
  {
    id: "cc-2025-08-28-weekly-effective",
    slug: "claude-code-weekly-rate-limits-effective-2025-08-28",
    date: "2025-08-28",
    agent: "claude-code",
    plans: ["Pro", "Max 5x", "Max 20x"],
    type: "schedule_change",
    title: "Weekly rate limits go live alongside 5-hour window",
    summary:
      "Two new rolling 7-day caps started enforcing for Claude Code subscribers: an overall weekly usage limit and a separate weekly Claude Opus 4 limit. They sit on top of the pre-existing 5-hour rolling session window.",
    details: [
      "Pro: ~40–80 hours of Sonnet 4 per 7-day window.",
      "Max 5x ($100): ~140–280h Sonnet 4 + ~15–35h Opus 4 per 7 days.",
      "Max 20x ($200): ~240–480h Sonnet 4 + ~24–40h Opus 4 per 7 days.",
      "Max subscribers can buy additional usage at standard API rates after hitting the cap.",
    ],
    source: {
      label: "How do usage and length limits work? (Anthropic Help Center)",
      url: "https://support.anthropic.com/en/articles/11647753-understanding-usage-and-length-",
    },
    secondarySources: [
      {
        label: "Use Claude Code with your Pro or Max plan",
        url: "https://support.anthropic.com/en/articles/11145838-using-claude-code-with-your-max-plan",
      },
    ],
  },
  {
    id: "cc-2025-07-28-weekly-announced",
    slug: "claude-code-weekly-rate-limits-announced-2025-07-28",
    date: "2025-07-28",
    effectiveDate: "2025-08-28",
    agent: "claude-code",
    plans: ["Pro", "Max 5x", "Max 20x"],
    type: "policy_change",
    title: "Anthropic announces weekly rate limits for Claude Code",
    summary:
      "Anthropic publicly announced upcoming weekly rate limits for Claude Code, aimed at users running the agent 24/7 in the background and at policy violations (account sharing, reselling). Estimated to affect <5% of subscribers.",
    details: [
      "Two new weekly caps: overall usage and Claude Opus 4 specifically.",
      "Existing 5-hour rolling session limit unchanged.",
      "Effective on August 28, 2025.",
    ],
    source: {
      label: "How do usage and length limits work? (Anthropic Help Center)",
      url: "https://support.anthropic.com/en/articles/11647753-understanding-usage-and-length-",
    },
    secondarySources: [
      {
        label: "Engadget coverage (Jul 28, 2025)",
        url: "https://www.engadget.com/ai/anthropic-is-rate-limiting-claude-code-blaming-some-users-for-never-turning-it-off-211134730.html",
      },
    ],
  },
];

export function getResetEventsSorted(): ResetEvent[] {
  return [...RESET_EVENTS].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function filterResetEventsByAgent(
  events: ResetEvent[],
  agent: ResetAgent | "all",
): ResetEvent[] {
  if (agent === "all") return events;
  return events.filter((e) => e.agent === agent);
}

export function getResetEventBySlug(slug: string): ResetEvent | undefined {
  return RESET_EVENTS.find((e) => e.slug === slug);
}

export function isResetAgent(value: string): value is ResetAgent {
  return value === "claude-code" || value === "codex";
}

/** Up to `limit` other events for the same agent, sorted by date descending. */
export function getRelatedResetEvents(event: ResetEvent, limit = 3): ResetEvent[] {
  return getResetEventsSorted()
    .filter((e) => e.agent === event.agent && e.slug !== event.slug)
    .slice(0, limit);
}

/**
 * Dev-time guard that catches duplicate slugs at module load. We throw rather
 * than silently allowing a duplicate to overwrite another event's static page.
 */
(() => {
  const seen = new Set<string>();
  for (const e of RESET_EVENTS) {
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(e.slug)) {
      throw new Error(
        `reset-log: invalid slug "${e.slug}" on event ${e.id} — must be kebab-case, lowercase`,
      );
    }
    if (seen.has(e.slug)) {
      throw new Error(`reset-log: duplicate slug "${e.slug}" — slugs must be unique`);
    }
    seen.add(e.slug);
  }
})();

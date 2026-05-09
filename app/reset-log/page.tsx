import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  AGENT_LABELS,
  AGENT_VENDORS,
  RESET_EVENT_TYPE_LABELS,
  filterResetEventsByAgent,
  getResetEventsSorted,
  type ResetAgent,
  type ResetEvent,
} from "@/data/reset-log";

const TITLE = "Reset Log — Codex & Claude Code quota events";
const DESCRIPTION =
  "A dated log of every public rate-limit, quota, and usage-window change to the two subscription-based code agents — Anthropic's Claude Code and OpenAI's Codex — with a link to the official record for each event.";

export const metadata: Metadata = {
  title: "Reset Log",
  description: DESCRIPTION,
  alternates: { canonical: "/reset-log" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

type AgentFilter = ResetAgent | "all";

function parseAgentFilter(raw: string | string[] | undefined): AgentFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "claude-code" || v === "codex") return v;
  return "all";
}

function formatDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

const FILTER_OPTIONS: { value: AgentFilter; label: string }[] = [
  { value: "all", label: "All agents" },
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
];

const AGENT_ACCENT: Record<ResetAgent, string> = {
  "claude-code": "#cc785c",
  codex: "#10a37f",
};

interface PageProps {
  searchParams: Promise<{ agent?: string | string[] }>;
}

export default async function ResetLogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter = parseAgentFilter(sp.agent);

  const allEvents = getResetEventsSorted();
  const events = filterResetEventsByAgent(allEvents, filter);

  const counts: Record<AgentFilter, number> = {
    all: allEvents.length,
    "claude-code": allEvents.filter((e) => e.agent === "claude-code").length,
    codex: allEvents.filter((e) => e.agent === "codex").length,
  };

  const lastUpdated = allEvents[0]?.date;

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary hover:text-primary"
          >
            ← ReleaseLog
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/pricing"
              className="font-medium text-secondary underline-offset-4 hover:text-primary hover:underline"
            >
              Pricing
            </Link>
            <Link
              href="/subscribe"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Subscribe
            </Link>
          </div>
        </div>

        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
            Reset Log
          </p>
          <h1 className="mt-2 font-serif text-4xl text-primary sm:text-5xl">
            Quota resets &amp; rate-limit changes for{" "}
            <span className="text-accent">Codex</span> and{" "}
            <span className="text-accent">Claude Code</span>.
          </h1>
          <p className="mt-4 text-base text-secondary sm:text-lg">
            A dated record of every publicly-announced change to the subscription
            quotas, rolling windows, and one-off resets for the two
            subscription-based code agents. Every entry links to the official
            record — vendor announcement, help-center article, changelog, or staff
            post.
          </p>
          {lastUpdated && (
            <p className="mt-3 text-xs text-secondary/70">
              Last logged event: {formatDate(lastUpdated)}.
            </p>
          )}
        </header>

        <nav
          aria-label="Filter by agent"
          className="mt-10 flex flex-wrap items-center gap-2"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            const href =
              opt.value === "all" ? "/reset-log" : `/reset-log?agent=${opt.value}`;
            return (
              <Link
                key={opt.value}
                href={href}
                className={
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium ring-1 transition-colors " +
                  (active
                    ? "bg-accent text-[var(--bg-page)] ring-accent"
                    : "bg-empty-cell/40 text-secondary ring-white/5 hover:bg-empty-cell/70 hover:text-primary")
                }
              >
                {opt.label}
                <span
                  className={
                    "rounded-full px-1.5 text-[10px] font-semibold " +
                    (active
                      ? "bg-[var(--bg-page)]/15 text-[var(--bg-page)]"
                      : "bg-empty-cell/60 text-secondary")
                  }
                >
                  {counts[opt.value]}
                </span>
              </Link>
            );
          })}
        </nav>

        {events.length === 0 ? (
          <p className="mt-12 rounded-2xl bg-panel/50 p-6 text-sm text-secondary ring-1 ring-white/5">
            No events recorded for this filter yet.
          </p>
        ) : (
          <ol className="mt-10 space-y-6">
            {events.map((event) => (
              <ResetEventCard key={event.id} event={event} />
            ))}
          </ol>
        )}

        <footer className="mt-16 space-y-3 border-t border-white/5 pt-6 text-xs text-secondary/80">
          <p>
            Spotted a missing reset or a wrong source? Email{" "}
            <a
              href="mailto:haoruileee@gmail.com"
              className="text-accent underline-offset-4 hover:underline"
            >
              haoruileee@gmail.com
            </a>{" "}
            with the date and the official record URL and we&rsquo;ll add it.
          </p>
          <p>
            Reset Log is curated manually from vendor announcements and help-center
            pages. It does not predict future resets — it only records ones that
            have already been publicly announced.
          </p>
        </footer>
      </div>
    </div>
  );
}

function ResetEventCard({ event }: { event: ResetEvent }) {
  const agentLabel = AGENT_LABELS[event.agent];
  const vendor = AGENT_VENDORS[event.agent];
  const accent = AGENT_ACCENT[event.agent];
  const typeLabel = RESET_EVENT_TYPE_LABELS[event.type];

  return (
    <li
      id={event.id}
      className="rounded-2xl bg-panel/60 p-5 ring-1 ring-white/5 transition-colors hover:bg-panel sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <time
          dateTime={event.date}
          className="font-mono font-semibold text-primary"
        >
          {formatDate(event.date)}
        </time>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-white/10"
          style={{ color: accent }}
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {agentLabel}
          <span className="text-secondary/70">· {vendor}</span>
        </span>
        <span className="rounded-full bg-empty-cell/60 px-2 py-0.5 text-[11px] font-medium text-secondary ring-1 ring-white/5">
          {typeLabel}
        </span>
        {event.effectiveDate && event.effectiveDate !== event.date && (
          <span className="text-[11px] text-secondary/80">
            Effective {formatDate(event.effectiveDate)}
          </span>
        )}
      </div>

      <h2 className="mt-3 font-serif text-xl sm:text-2xl">
        <Link
          href={`/reset-log/${event.slug}`}
          className="text-primary underline-offset-4 hover:text-accent hover:underline"
        >
          {event.title}
        </Link>
      </h2>

      <p className="mt-2 text-sm text-secondary sm:text-base">{event.summary}</p>

      {event.plans.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {event.plans.map((plan) => (
            <span
              key={plan}
              className="rounded-full bg-empty-cell/40 px-2 py-0.5 text-[11px] font-medium text-secondary ring-1 ring-white/5"
            >
              {plan}
            </span>
          ))}
        </div>
      )}

      {event.details && event.details.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-secondary">
          {event.details.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-accent/70">
                ·
              </span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <a
          href={event.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 font-medium text-accent ring-1 ring-accent/30 hover:bg-accent/20"
        >
          Official record: {event.source.label}
          <span aria-hidden>↗</span>
        </a>
        <Link
          href={`/reset-log/${event.slug}`}
          className="font-medium text-secondary underline-offset-4 hover:text-primary hover:underline"
        >
          Read full event →
        </Link>
        {event.secondarySources?.map((src) => (
          <a
            key={src.url}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary underline-offset-4 hover:text-primary hover:underline"
          >
            {src.label} ↗
          </a>
        ))}
      </div>
    </li>
  );
}

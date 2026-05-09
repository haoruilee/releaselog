import Link from "next/link";
import type { CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import { entityMetas } from "@/data";
import {
  AGENT_LABELS,
  AGENT_VENDORS,
  RESET_AGENT_SLUGS,
  RESET_EVENT_TYPE_LABELS,
  filterResetEventsByAgent,
  getResetEventsSorted,
  type ResetAgent,
  type ResetEvent,
} from "@/data/reset-log";
import { getServerTranslator, type Translator } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ResetLogCalendar } from "./ResetLogCalendar";
import { ResetLogExportButton } from "./ResetLogExportButton";

type AgentFilter = ResetAgent | "all";

const RESET_LOG_THEME = {
  "--bg-page": "#eef8f0",
  "--bg-panel": "#f8fff9",
  "--bg-empty-cell": "#d9ecde",
  "--bg-active-cell": "#b7dfc3",
  "--text-primary": "#123d2b",
  "--text-secondary": "#4f7b61",
  "--accent": "#2f8f5b",
  "--accent-number": "#1f7a4a",
} as CSSProperties;

function formatDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

function buildFilterOptions(t: Translator): {
  value: AgentFilter;
  label: string;
  href: string;
}[] {
  return [
    { value: "all", label: t("switcher.all_agents"), href: "/reset-log" },
    ...RESET_AGENT_SLUGS.map((agent) => ({
      value: agent,
      label: AGENT_LABELS[agent],
      href: `/reset-log/${agent}`,
    })),
  ];
}

const AGENT_ACCENT: Record<ResetAgent, string> = {
  "claude-code": "#cc785c",
  codex: "#10a37f",
};

export async function ResetLogList({
  filter = "all",
}: {
  filter?: AgentFilter;
}) {
  const { t } = await getServerTranslator();
  const allEvents = getResetEventsSorted();
  const events = filterResetEventsByAgent(allEvents, filter);

  const counts: Record<AgentFilter, number> = {
    all: allEvents.length,
    "claude-code": allEvents.filter((e) => e.agent === "claude-code").length,
    codex: allEvents.filter((e) => e.agent === "codex").length,
  };

  const lastUpdated = events[0]?.date ?? allEvents[0]?.date;
  const heading =
    filter === "all"
      ? t("reset_log.heading_all")
      : t("reset_log.heading_agent", { agent: AGENT_LABELS[filter] });

  const exportFilenamePrefix =
    filter === "all" ? "reset-log" : `reset-log-${filter}`;

  const filterOptions = buildFilterOptions(t);

  return (
    <div className="min-h-screen bg-page text-primary" style={RESET_LOG_THEME}>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div
          data-export-exclude
          className="mb-10 flex items-center justify-between gap-3"
        >
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary hover:text-primary"
          >
            {t("nav.back_home")}
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <LanguageSwitcher />
            <ResetLogExportButton filenamePrefix={exportFilenamePrefix} />
            <Link
              href="/pricing"
              className="font-medium text-secondary underline-offset-4 hover:text-primary hover:underline"
            >
              {t("nav.pricing")}
            </Link>
            <Link
              href="/subscribe"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("nav.subscribe")}
            </Link>
          </div>
        </div>

        <div data-export-root className="rounded-2xl bg-page">
          <header className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
              {t("reset_log.kicker")}
            </p>
            <h1 className="mt-2 font-serif text-4xl text-primary sm:text-5xl">
              {heading}
            </h1>
            <p className="mt-4 text-base text-secondary sm:text-lg">
              {t("reset_log.intro")}
            </p>
            {lastUpdated && (
              <p className="mt-3 text-xs text-secondary/70">
                {t("reset_log.last_logged", { date: formatDate(lastUpdated) })}
              </p>
            )}
          </header>

          <ResetLogCalendar events={events} />

          <p className="mt-6 text-[11px] uppercase tracking-[0.25em] text-secondary/70">
            releaselog.site/reset-log
          </p>
        </div>

        <nav
          data-export-exclude
          aria-label={t("switcher.team_product")}
          className="mt-8 flex flex-wrap items-center gap-2"
        >
          <span className="text-xs uppercase tracking-wider text-secondary/80">
            {t("switcher.team_product")}
          </span>
          <div className="flex flex-wrap gap-2">
            {entityMetas.slice(0, 1).map((entity) => (
              <Link
                key={entity.id}
                href={`/${entity.id}`}
                className="rounded-full bg-empty-cell px-4 py-1.5 text-sm font-medium text-secondary transition-colors hover:bg-panel hover:text-primary"
              >
                {entity.name}
              </Link>
            ))}
            <Link
              href="/reset-log"
              className="rounded-full bg-active-cell px-4 py-1.5 text-sm font-medium text-primary shadow-sm ring-1 ring-white/10"
            >
              {t("switcher.reset_log")}
            </Link>
            {entityMetas.slice(1).map((entity) => (
              <Link
                key={entity.id}
                href={`/${entity.id}`}
                className="rounded-full bg-empty-cell px-4 py-1.5 text-sm font-medium text-secondary transition-colors hover:bg-panel hover:text-primary"
              >
                {entity.name}
              </Link>
            ))}
          </div>
        </nav>

        <nav
          data-export-exclude
          aria-label={t("switcher.agent")}
          className="mt-5 flex flex-wrap items-center gap-2"
        >
          <span className="text-xs uppercase tracking-wider text-secondary/80">
            {t("switcher.agent")}
          </span>
          {filterOptions.map((opt) => {
            const active = filter === opt.value;
            return (
              <Link
                key={opt.value}
                href={opt.href}
                className={
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-active-cell text-primary shadow-sm ring-1 ring-white/10"
                    : "bg-empty-cell text-secondary hover:bg-panel hover:text-primary")
                }
              >
                {opt.label}
                <span
                  className={
                    "rounded-full px-1.5 text-[10px] font-semibold " +
                    (active
                      ? "bg-[var(--bg-page)]/15 text-primary"
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
          <p
            data-export-exclude
            className="mt-12 rounded-2xl bg-panel/50 p-6 text-sm text-secondary ring-1 ring-white/5"
          >
            {t("reset_log.no_events")}
          </p>
        ) : (
          <ol data-export-exclude className="mt-12 space-y-6">
            {events.map((event) => (
              <ResetEventCard key={event.id} event={event} t={t} />
            ))}
          </ol>
        )}

        <footer
          data-export-exclude
          className="mt-16 space-y-3 border-t border-white/5 pt-6 text-xs text-secondary/80"
        >
          <p>
            {t("reset_log.footer_email_lead")}{" "}
            <a
              href="mailto:haoruileee@gmail.com"
              className="text-accent underline-offset-4 hover:underline"
            >
              haoruileee@gmail.com
            </a>{" "}
            {t("reset_log.footer_email_tail")}
          </p>
          <p>{t("reset_log.footer_disclaimer")}</p>
        </footer>
      </div>
    </div>
  );
}

function ResetEventCard({
  event,
  t,
}: {
  event: ResetEvent;
  t: Translator;
}) {
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
        <Link
          href={`/reset-log/${event.agent}`}
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
        </Link>
        <span className="rounded-full bg-empty-cell/60 px-2 py-0.5 text-[11px] font-medium text-secondary ring-1 ring-white/5">
          {typeLabel}
        </span>
        {event.effectiveDate && event.effectiveDate !== event.date && (
          <span className="text-[11px] text-secondary/80">
            {t("reset_log.effective", { date: formatDate(event.effectiveDate) })}
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
          {t("reset_log.official_record", { label: event.source.label })}
          <span aria-hidden>↗</span>
        </a>
        <Link
          href={`/reset-log/${event.slug}`}
          className="font-medium text-secondary underline-offset-4 hover:text-primary hover:underline"
        >
          {t("reset_log.read_full")}
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

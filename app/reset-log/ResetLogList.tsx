import { AdPlacement } from "@/components/Advertising";
import { getLiveResetEvents } from "@/lib/reset-log-live";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AGENT_LABELS, RESET_AGENT_SLUGS, filterResetEventsByAgent, type ResetAgent } from "@/data/reset-log";
import { getServerTranslator } from "@/lib/i18n";
import { ResetLogCalendar } from "./ResetLogCalendar";
import { ResetLogExportButton } from "./ResetLogExportButton";
import { ResetTimeline } from "./ResetTimeline";
type AgentFilter = ResetAgent | "all";

export async function ResetLogList({ filter = "all" }: { filter?: AgentFilter }) {
  const { t } = await getServerTranslator();
  const allEvents = await getLiveResetEvents();
  const events = filterResetEventsByAgent(allEvents, filter);
  const counts: Record<AgentFilter, number> = { all: allEvents.length, "claude-code": allEvents.filter(e => e.agent === "claude-code").length, codex: allEvents.filter(e => e.agent === "codex").length };
  const lastUpdated = events[0]?.date ?? allEvents[0]?.date;
  const heading = filter === "all" ? t("reset_log.heading_all") : t("reset_log.heading_agent", { agent: AGENT_LABELS[filter] });
  const options = [{ value: "all", label: t("switcher.all_agents"), href: "/reset-log" }, ...RESET_AGENT_SLUGS.map(agent => ({ value: agent, label: AGENT_LABELS[agent], href: `/reset-log/${agent}` }))];
  return <div className="bg-page text-primary">
    <main className="mx-auto max-w-[1344px] px-6 pb-16 pt-10 sm:px-10 lg:px-12">
      <div data-export-root className="bg-page">
        <header>
          <h1 className="editorial-title max-w-5xl text-4xl sm:text-[48px] lg:text-[52px]">{heading}</h1>
          <p className="mt-4 max-w-5xl text-base leading-relaxed text-secondary sm:text-[17px]">{t("reset_log.intro")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {lastUpdated && <p className="text-sm text-secondary">{t("reset_log.last_logged", { date: format(parseISO(lastUpdated), "MMM d, yyyy") })}</p>}
            <div data-export-exclude><ResetLogExportButton filenamePrefix={filter === "all" ? "reset-log" : `reset-log-${filter}`} /></div>
          </div>
        </header>
        <ResetLogCalendar events={events} />
      </div>
      <AdPlacement position="reset-banner" className="my-6" />
      <nav data-export-exclude aria-label={t("switcher.agent")} className="flex flex-wrap gap-5 border-b border-slate-200">
        {options.map(option => <Link key={option.value} href={option.href} aria-current={filter === option.value ? "page" : undefined} className={`border-b-2 px-1 py-3 text-sm font-medium ${filter === option.value ? "border-accent text-accent" : "border-transparent text-secondary hover:text-primary"}`}>{option.label} <span className="ml-1 tabular-nums">({counts[option.value as AgentFilter]})</span></Link>)}
      </nav>
      <ResetTimeline events={events} />
      <footer data-export-exclude className="mt-12 space-y-3 border-t border-slate-200 pt-6 text-xs leading-relaxed text-secondary"><p>{t("reset_log.footer_email_lead")} <a href="mailto:haoruileee@gmail.com" className="text-accent underline-offset-4 hover:underline">haoruileee@gmail.com</a> {t("reset_log.footer_email_tail")}</p><p>{t("reset_log.footer_disclaimer")}</p></footer>
    </main>
  </div>;
}

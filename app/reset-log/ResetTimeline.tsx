"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AGENT_ACCENT, AGENT_LABELS, RESET_EVENT_TYPE_LABELS, type ResetEvent } from "@/data/reset-log";
import { useT } from "@/components/I18nProvider";

export function ResetTimeline({ events }: { events: ResetEvent[] }) {
  const t = useT(); const [query, setQuery] = useState(""); const [visible, setVisible] = useState(20);
  const filtered = useMemo(() => { const term = query.trim().toLocaleLowerCase(); return term ? events.filter(event => [event.title, event.summary, event.date, AGENT_LABELS[event.agent], ...event.plans].join(" ").toLocaleLowerCase().includes(term)) : events; }, [events, query]);
  return <section data-export-exclude aria-label={t("timeline.search")}>
    <div className="flex flex-wrap items-center justify-between gap-3 py-5">
      <label className="relative block w-full sm:max-w-sm"><span className="sr-only">{t("timeline.search")}</span><svg className="pointer-events-none absolute left-3 top-3 text-secondary" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><input type="search" value={query} onChange={event => { setQuery(event.target.value); setVisible(20); }} placeholder={t("timeline.placeholder")} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm" /></label>
      <p role="status" className="text-xs text-secondary">{t("timeline.count", { visible: Math.min(visible, filtered.length), total: filtered.length })}</p>
    </div>
    {filtered.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 px-5 py-10 text-center"><p className="text-sm text-secondary">{t("timeline.empty")}</p><button type="button" onClick={() => setQuery("")} className="mt-3 px-3 py-2 text-sm font-medium text-accent">{t("timeline.clear")}</button></div> : <ol data-timeline-list className="divide-y divide-slate-200 border-t border-slate-200">
      {filtered.slice(0, visible).map(event => { const accent = AGENT_ACCENT[event.agent]; return <li key={event.id} id={event.id} className="grid gap-3 py-6 sm:grid-cols-[128px_1fr] sm:gap-6">
        <time dateTime={event.date} className="pt-1 text-sm font-medium text-secondary">{format(parseISO(event.date), "MMM d, yyyy")}</time>
        <article className="min-w-0 sm:border-l sm:border-slate-200 sm:pl-6">
          <h2 className="font-serif text-[25px] leading-tight text-primary sm:text-[28px]"><Link href={`/reset-log/${event.slug}`} className="hover:text-accent">{event.title}</Link></h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><Link href={`/reset-log/${event.agent}`} style={{ background: accent.bg, color: accent.text }} className="rounded-md px-2 py-1 font-medium">{AGENT_LABELS[event.agent]}</Link><span className="rounded-md bg-empty-cell px-2 py-1 text-secondary">{RESET_EVENT_TYPE_LABELS[event.type]}</span>{event.effectiveDate && event.effectiveDate !== event.date && <span className="text-secondary">{t("reset_log.effective", { date: format(parseISO(event.effectiveDate), "MMM d, yyyy") })}</span>}</div>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-secondary sm:text-[15px]">{event.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><Link href={`/reset-log/${event.slug}`} className="py-1 font-medium text-accent">{t("reset_log.read_full")}</Link><a href={event.source.url} target="_blank" rel="noopener noreferrer" className="break-all py-1 text-accent underline-offset-4 hover:underline">{t(event.verification === "source-linked" ? "reset_log.linked_record" : "reset_log.official_record", { label: event.source.label })} ↗</a>{event.verification === "source-linked" && <span className="text-secondary">{t("reset_log.source_linked")}</span>}</div>
        </article>
      </li>; })}
    </ol>}
    {visible < filtered.length && <div className="flex justify-center pt-6"><button type="button" onClick={() => setVisible(n => n + 20)} className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-primary hover:bg-panel">{t("timeline.more")}</button></div>}
  </section>;
}

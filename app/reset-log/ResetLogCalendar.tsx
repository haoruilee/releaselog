"use client";

import { useMemo, useState } from "react";
import { CalendarBoard } from "@/components/CalendarBoard";
import { DayDetails } from "@/components/DayDetails";
import type { ReleaseItem } from "@/data/types";
import { buildCalendarMonths, filterReleasesInRange } from "@/lib/calendar";
import { getRangeBounds } from "@/lib/stats";
import { AGENT_ACCENT, AGENT_LABELS, type ResetEvent } from "@/data/reset-log";
import { useT } from "@/components/I18nProvider";

function todayNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toCalendarItem(event: ResetEvent): ReleaseItem {
  const accent = AGENT_ACCENT[event.agent];
  return {
    id: event.id,
    date: event.date,
    title: event.title,
    shortTitle: `${AGENT_LABELS[event.agent]}: ${event.title}`,
    description: event.summary,
    kind: "event",
    sourceUrl: `/reset-log/${event.slug}`,
    docUrls: [event.source.url, ...(event.secondarySources?.map((s) => s.url) ?? [])],
    tags: [AGENT_LABELS[event.agent], event.type.replaceAll("_", " "), ...event.plans],
    importance: event.type === "manual_reset" ? 3 : 2,
    accentColor: accent.badge,
    accentTextColor: accent.text,
  };
}

export function ResetLogCalendar({ events }: { events: ResetEvent[] }) {
  const t = useT();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const today = useMemo(() => todayNoon(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);
  const { start, end } = useMemo(() => getRangeBounds(today, 3), [today]);
  const calendarItems = useMemo(() => events.map(toCalendarItem), [events]);
  const itemsInRange = useMemo(
    () => filterReleasesInRange(calendarItems, start, end),
    [calendarItems, start, end],
  );
  const months = useMemo(
    () => buildCalendarMonths(start, end, itemsInRange),
    [start, end, itemsInRange],
  );
  const itemsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return itemsInRange.filter((item) => item.date === selectedDate);
  }, [itemsInRange, selectedDate]);

  return (
    <section className="reset-calendar mt-6">
      <button type="button" aria-expanded={expanded} aria-controls="reset-calendar-grid" onClick={() => setExpanded(v => !v)} className="flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-200 px-4 text-sm font-medium text-primary md:hidden">{t(expanded ? "site.hide_calendar" : "site.show_calendar")} <span aria-hidden>{expanded ? "−" : "+"}</span></button>
      <div id="reset-calendar-grid" className={`${expanded ? "block" : "hidden"} mt-3 rounded-xl border border-slate-200 p-4 md:mt-0 md:block`}>
      <CalendarBoard
        months={months}
        rangeMonths={3}
        selectedDate={selectedDate}
        todayKey={todayKey}
        onSelectDate={setSelectedDate}
      />
      <div className="mt-3 flex flex-wrap items-center gap-5 border-t border-slate-200 pt-3 text-xs text-secondary"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-orange-100" aria-hidden />Codex</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-green-100" aria-hidden />Claude Code</span><span>{t("reset_log.calendar_helper")}</span></div>
      </div>

      {selectedDate && itemsForSelectedDay.length > 0 && (
        <DayDetails
          dateStr={selectedDate}
          items={itemsForSelectedDay}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </section>
  );
}

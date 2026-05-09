"use client";

import { useMemo, useState } from "react";
import { CalendarBoard } from "@/components/CalendarBoard";
import { DayDetails } from "@/components/DayDetails";
import type { ReleaseItem } from "@/data/types";
import { buildCalendarMonths, filterReleasesInRange } from "@/lib/calendar";
import { getRangeBounds } from "@/lib/stats";
import { AGENT_LABELS, type ResetEvent } from "@/data/reset-log";
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
  };
}

export function ResetLogCalendar({ events }: { events: ResetEvent[] }) {
  const t = useT();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {t("reset_log.calendar_heading")}
          </h2>
          <p className="mt-1 text-sm text-secondary">
            {t("reset_log.calendar_helper")}
          </p>
        </div>
      </div>

      <CalendarBoard
        months={months}
        rangeMonths={3}
        selectedDate={selectedDate}
        todayKey={todayKey}
        onSelectDate={setSelectedDate}
      />

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

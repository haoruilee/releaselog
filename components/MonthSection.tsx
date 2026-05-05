"use client";

import type { CalendarMonth } from "@/lib/calendar";
import { DayCell } from "./DayCell";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  month: CalendarMonth;
  maxVisible: number;
  showCountOnly: boolean;
  selectedDate: string | null;
  todayKey: string;
  onSelectDate: (date: string) => void;
};

export function MonthSection({
  month,
  maxVisible,
  showCountOnly,
  selectedDate,
  todayKey,
  onSelectDate,
}: Props) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.2em] text-accent">
        {month.monthLabel.split(" ")[0]?.toUpperCase() ?? month.monthLabel}
      </h2>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekdays.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-[10px] font-medium uppercase tracking-wider text-secondary/50"
          >
            {w}
          </div>
        ))}
        {month.weeks.map((week) =>
          week.map((day) => (
            <DayCell
              key={`${month.monthKey}-${day.date}`}
              dateStr={day.date}
              inMonth={day.inMonth}
              items={day.items}
              maxVisible={maxVisible}
              showCountOnly={showCountOnly}
              selected={selectedDate === day.date}
              todayKey={todayKey}
              onSelect={onSelectDate}
            />
          )),
        )}
      </div>
    </section>
  );
}

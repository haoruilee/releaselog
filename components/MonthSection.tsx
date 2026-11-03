"use client";

import type { CalendarMonth } from "@/lib/calendar";
import { useT } from "@/components/I18nProvider";
import { DayCell } from "./DayCell";

const WEEKDAY_KEYS = [
  "weekdays.mon",
  "weekdays.tue",
  "weekdays.wed",
  "weekdays.thu",
  "weekdays.fri",
  "weekdays.sat",
  "weekdays.sun",
] as const;

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
  const t = useT();
  return (
    <section className="calendar-month">
      <h2 className="bg-panel px-4 py-3 font-serif text-[23px] text-primary">
        {month.monthLabel}
      </h2>
      <div className="grid grid-cols-7">
        {WEEKDAY_KEYS.map((key) => (
          <div
            key={key}
            className="py-2 text-center text-[11px] font-medium text-secondary"
          >
            {t(key)}
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

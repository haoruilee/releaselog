"use client";

import type { CalendarMonth } from "@/lib/calendar";
import { MonthSection } from "./MonthSection";

type Props = {
  months: CalendarMonth[];
  rangeMonths: 1 | 3 | 6;
  selectedDate: string | null;
  todayKey: string;
  onSelectDate: (date: string) => void;
};

function densityForRange(rangeMonths: 1 | 3 | 6): {
  maxVisible: number;
  showCountOnly: boolean;
} {
  if (rangeMonths === 1) return { maxVisible: 3, showCountOnly: false };
  if (rangeMonths === 3) return { maxVisible: 2, showCountOnly: false };
  return { maxVisible: 1, showCountOnly: true };
}

export function CalendarBoard({
  months,
  rangeMonths,
  selectedDate,
  todayKey,
  onSelectDate,
}: Props) {
  const { maxVisible, showCountOnly } = densityForRange(rangeMonths);

  return (
    <div className="space-y-12">
      {months.map((m) => (
        <MonthSection
          key={m.monthKey}
          month={m}
          maxVisible={maxVisible}
          showCountOnly={showCountOnly}
          selectedDate={selectedDate}
          todayKey={todayKey}
          onSelectDate={onSelectDate}
        />
      ))}
    </div>
  );
}

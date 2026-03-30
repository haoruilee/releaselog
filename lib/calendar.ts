import {
  addDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameMonth,
  startOfWeek,
} from "date-fns";
import type { ReleaseItem } from "@/data/types";

export type CalendarDay = {
  date: string;
  inMonth: boolean;
  items: ReleaseItem[];
};

export type CalendarMonth = {
  monthKey: string;
  monthLabel: string;
  weeks: CalendarDay[][];
};

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function aggregateByDate(items: ReleaseItem[]): Map<string, ReleaseItem[]> {
  const map = new Map<string, ReleaseItem[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return map;
}

function sortItemsForCell(items: ReleaseItem[]): ReleaseItem[] {
  return [...items].sort((a, b) => {
    const ia = a.importance ?? 1;
    const ib = b.importance ?? 1;
    if (ib !== ia) return ib - ia;
    return a.title.localeCompare(b.title);
  });
}

export function buildCalendarMonths(
  rangeStart: Date,
  rangeEnd: Date,
  releasesInRange: ReleaseItem[],
): CalendarMonth[] {
  const byDate = aggregateByDate(releasesInRange);
  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });

  const result: CalendarMonth[] = [];

  for (const monthStart of months) {
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const lastRowStart = startOfWeek(monthEnd, { weekStartsOn: 1 });
    const weeks: CalendarDay[][] = [];
    let cursor = gridStart;

    while (true) {
      const week: CalendarDay[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(cursor, i);
        const key = toDateKey(d);
        const inMonth = isSameMonth(d, monthStart);
        const inRange = !isBefore(d, rangeStart) && !isBefore(rangeEnd, d);
        const raw = byDate.get(key) ?? [];
        const items = inRange && inMonth ? sortItemsForCell(raw) : [];

        week.push({
          date: key,
          inMonth,
          items,
        });
      }
      weeks.push(week);
      if (cursor.getTime() === lastRowStart.getTime()) break;
      cursor = addDays(cursor, 7);
    }

    result.push({
      monthKey: format(monthStart, "yyyy-MM"),
      monthLabel: format(monthStart, "MMMM yyyy"),
      weeks,
    });
  }

  return result;
}

export function filterReleasesInRange(
  releases: ReleaseItem[],
  rangeStart: Date,
  rangeEnd: Date,
): ReleaseItem[] {
  return releases.filter((r) => {
    const d = new Date(r.date + "T12:00:00");
    return !isBefore(d, rangeStart) && !isBefore(rangeEnd, d);
  });
}

import {
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  endOfMonth,
  min as minDate,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { ReleaseItem } from "@/data/types";

export type SummaryStats = {
  totalReleases: number;
  activeDays: number;
  avgPerWeek: number;
  busiestMonthLabel: string | null;
  daySpan: number;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function computeSummaryStats(
  items: ReleaseItem[],
  rangeStart: Date,
  rangeEnd: Date,
): SummaryStats {
  const filtered = items.filter((r) => {
    const d = new Date(r.date + "T12:00:00");
    return d >= rangeStart && d <= rangeEnd;
  });

  const byDay = new Map<string, ReleaseItem[]>();
  for (const r of filtered) {
    const list = byDay.get(r.date) ?? [];
    list.push(r);
    byDay.set(r.date, list);
  }

  const activeDays = byDay.size;
  const totalReleases = filtered.length;

  const daySpan = Math.max(
    1,
    differenceInCalendarDays(rangeEnd, rangeStart) + 1,
  );
  const weeks = Math.max(1, differenceInCalendarWeeks(rangeEnd, rangeStart));
  const avgPerWeek = Math.round((totalReleases / weeks) * 10) / 10;

  const monthCounts = new Map<string, number>();
  for (const r of filtered) {
    const d = new Date(r.date + "T12:00:00");
    const key = monthKey(d);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  let busiestMonthLabel: string | null = null;
  let maxCount = 0;
  for (const [key, count] of monthCounts) {
    if (count > maxCount) {
      maxCount = count;
      const [y, m] = key.split("-").map(Number);
      busiestMonthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
  }

  return {
    totalReleases,
    activeDays,
    avgPerWeek,
    busiestMonthLabel: maxCount > 0 ? busiestMonthLabel : null,
    daySpan,
  };
}

export function getRangeBounds(
  today: Date,
  monthsBack: 1 | 3 | 6,
): { start: Date; end: Date } {
  const currentMonthStart = startOfMonth(today);
  const start = startOfMonth(subMonths(currentMonthStart, monthsBack - 1));
  const end = minDate([endOfMonth(today), today]);
  return { start, end };
}

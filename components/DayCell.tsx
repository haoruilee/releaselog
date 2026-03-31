"use client";

import type { ReleaseItem } from "@/data/types";
import { format, isToday } from "date-fns";

type Props = {
  dateStr: string;
  inMonth: boolean;
  items: ReleaseItem[];
  maxVisible: number;
  showCountOnly: boolean;
  selected: boolean;
  onSelect: (date: string) => void;
};

export function DayCell({
  dateStr,
  inMonth,
  items,
  maxVisible,
  showCountOnly,
  selected,
  onSelect,
}: Props) {
  const d = new Date(dateStr + "T12:00:00");
  const dayNum = format(d, "d");
  const hasItems = items.length > 0;
  const isTodayCell = isToday(d);

  if (!inMonth) {
    return <div className="min-h-[88px] rounded-lg opacity-0" aria-hidden />;
  }

  const base =
    "group relative flex min-h-[88px] flex-col rounded-lg p-2 text-left transition-all sm:min-h-[100px]";
  const bg = hasItems ? "bg-active-cell" : "bg-empty-cell";
  const ring = selected
    ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-page)]"
    : isTodayCell && hasItems
      ? "ring-1 ring-white/40"
      : "ring-1 ring-white/5";

  const visible = showCountOnly
    ? []
    : items.slice(0, maxVisible);
  const overflow = Math.max(0, items.length - visible.length);

  return (
    <div className={`${base} ${bg} ${ring}`}>
      <button
        type="button"
        onClick={() => onSelect(dateStr)}
        aria-label={`Show releases for ${dateStr}`}
        className="absolute inset-0 z-0 rounded-lg hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      />
      <span
        className={`pointer-events-none relative z-10 text-[11px] font-medium tabular-nums sm:text-xs ${
          hasItems ? "text-primary/90" : "text-secondary/60"
        }`}
      >
        {dayNum}
      </span>
      <div className="pointer-events-none relative z-10 mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden text-left">
        {showCountOnly && hasItems && (
          <span className="text-xs font-semibold text-primary">
            {items.length} ship{items.length === 1 ? "" : "s"}
          </span>
        )}
        {!showCountOnly &&
          visible.map((item) =>
            item.sourceUrl ? (
              <a
                key={item.id}
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto line-clamp-1 text-[10px] leading-tight text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:underline sm:text-[11px]"
                title={item.title}
              >
                {item.shortTitle ?? item.title}
              </a>
            ) : (
              <span
                key={item.id}
                className="line-clamp-1 text-[10px] leading-tight text-primary sm:text-[11px]"
                title={item.title}
              >
                {item.shortTitle ?? item.title}
              </span>
            ),
          )}
        {!showCountOnly && overflow > 0 && (
          <span className="text-[10px] font-medium text-primary/80">
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  );
}

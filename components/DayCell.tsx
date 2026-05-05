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
  todayKey: string;
  onSelect: (date: string) => void;
};

export function DayCell({
  dateStr,
  inMonth,
  items,
  maxVisible,
  showCountOnly,
  selected,
  todayKey,
  onSelect,
}: Props) {
  const d = new Date(dateStr + "T12:00:00");
  const dayNum = format(d, "d");
  const hasItems = items.length > 0;
  const hasEvents = items.some((item) => item.kind === "event");
  const isFuture = dateStr > todayKey;
  const isTodayCell = isToday(d);

  if (!inMonth) {
    return <div className="min-h-[88px] rounded-lg opacity-0" aria-hidden />;
  }

  const base =
    "group relative flex min-h-[88px] flex-col rounded-lg p-2 text-left transition-all sm:min-h-[100px]";
  const bg = hasItems
    ? isFuture
      ? "bg-active-cell/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm"
      : "bg-active-cell"
    : isFuture
      ? "bg-empty-cell/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm"
      : "bg-empty-cell";
  const ring = selected
    ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-page)]"
    : isTodayCell && hasItems
      ? "ring-1 ring-white/40"
      : isFuture && hasItems
        ? "ring-1 ring-white/20"
        : isFuture
          ? "ring-1 ring-white/10"
      : "ring-1 ring-white/5";
  const futureClass = isFuture ? "opacity-75 saturate-[0.82]" : "";

  const visible = showCountOnly
    ? []
    : items.slice(0, maxVisible);
  const overflow = Math.max(0, items.length - visible.length);

  return (
    <div className={`${base} ${bg} ${ring} ${futureClass}`}>
      {isFuture && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_42%)]"
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(dateStr)}
        aria-label={`Show logs for ${dateStr}`}
        className="absolute inset-0 z-0 rounded-lg hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      />
      <span
        className={`pointer-events-none relative z-10 flex items-center justify-between text-[11px] font-medium tabular-nums sm:text-xs ${
          hasItems ? "text-primary/90" : "text-secondary/60"
        }`}
      >
        <span>{dayNum}</span>
        {isFuture && <span className="h-1.5 w-1.5 rounded-full bg-primary/45" aria-hidden />}
      </span>
      <div className="pointer-events-none relative z-10 mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden text-left">
        {showCountOnly && hasItems && (
          <span className="text-xs font-semibold text-primary">
            {items.length} log{items.length === 1 ? "" : "s"}
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
                {item.kind === "event" && <span className="mr-1 text-primary/70">Event</span>}
                {item.shortTitle ?? item.title}
              </a>
            ) : (
              <span
                key={item.id}
                className="line-clamp-1 text-[10px] leading-tight text-primary sm:text-[11px]"
                title={item.title}
              >
                {item.kind === "event" && <span className="mr-1 text-primary/70">Event</span>}
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
      {hasEvents && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 right-1.5 h-1.5 w-6 rounded-full bg-primary/35"
        />
      )}
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";
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
    return <div className="calendar-cell min-h-[88px] bg-panel" aria-hidden />;
  }

  // Items can opt in to a per-agent / per-brand color. We pick the first
  // override (sortItemsForCell already promotes the most important item) so
  // the cell visually belongs to the dominant event for the day.
  const accentItem = hasItems
    ? items.find((it) => it.accentColor) ?? null
    : null;
  const wrapperStyle: CSSProperties | undefined = accentItem?.accentColor
    ? { backgroundColor: `color-mix(in srgb, ${accentItem.accentColor} 13%, white)` }
    : undefined;
  const accentTextStyle: CSSProperties | undefined = accentItem?.accentTextColor
    ? { color: "#29313a" }
    : undefined;

  const base =
    "calendar-cell group relative flex min-h-[88px] flex-col p-2 text-left transition-colors sm:min-h-[100px]";
  const bg = hasItems
    ? isFuture
      ? "bg-active-cell/55"
      : "bg-active-cell"
    : isFuture
      ? "bg-panel"
      : "bg-white";
  const ring = selected
    ? "ring-2 ring-inset ring-accent"
    : isTodayCell && hasItems
      ? "ring-1 ring-slate-200"
      : isFuture && hasItems
        ? "ring-1 ring-slate-200"
        : isFuture
          ? "ring-1 ring-slate-200"
      : "ring-1 ring-slate-200";
  const futureClass = "";

  const visible = showCountOnly
    ? []
    : items.slice(0, maxVisible);
  const overflow = Math.max(0, items.length - visible.length);

  return (
    <div className={`${base} ${bg} ${ring} ${futureClass}`} style={wrapperStyle}>

      <button
        type="button"
        onClick={() => onSelect(dateStr)}
        aria-label={`Show logs for ${dateStr}`}
        aria-pressed={selected}
        data-has-items={hasItems}
        className="absolute inset-0 z-0 hover:bg-black/[.025] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      />
      <span
        className={`pointer-events-none relative z-10 flex items-center justify-between text-[11px] font-medium tabular-nums sm:text-xs ${
          hasItems ? "text-primary/90" : "text-secondary"
        }`}
        style={hasItems ? accentTextStyle : undefined}
      >
        <span>{dayNum}</span>

      </span>
      <div className="pointer-events-none relative z-10 mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden text-left">
        {showCountOnly && hasItems && (
          <span className="calendar-count text-xs font-medium text-accent" style={accentTextStyle}>
            {items.length}
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
                style={accentTextStyle}
                title={item.title}
              >
                {item.kind === "event" && (
                  <span className="mr-1 text-primary/70" style={accentTextStyle}>
                    Event
                  </span>
                )}
                {item.shortTitle ?? item.title}
              </a>
            ) : (
              <span
                key={item.id}
                className="line-clamp-1 text-[10px] leading-tight text-primary sm:text-[11px]"
                style={accentTextStyle}
                title={item.title}
              >
                {item.kind === "event" && (
                  <span className="mr-1 text-primary/70" style={accentTextStyle}>
                    Event
                  </span>
                )}
                {item.shortTitle ?? item.title}
              </span>
            ),
          )}
        {!showCountOnly && overflow > 0 && (
          <span
            className="text-[10px] font-medium text-primary/80"
            style={accentTextStyle}
          >
            +{overflow} more
          </span>
        )}
      </div>
      {hasEvents && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 right-1.5 h-1.5 w-6 rounded-full bg-primary/35"
          style={
            accentTextStyle
              ? { backgroundColor: accentTextStyle.color, opacity: 0.35 }
              : undefined
          }
        />
      )}
    </div>
  );
}

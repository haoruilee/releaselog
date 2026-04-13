"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarBoard } from "@/components/CalendarBoard";
import { DayDetails } from "@/components/DayDetails";
import { EntitySwitcher } from "@/components/EntitySwitcher";
import { Header } from "@/components/Header";
import { PosterToolbar } from "@/components/PosterToolbar";
import { RangeSwitcher } from "@/components/RangeSwitcher";
import { SummaryStats } from "@/components/SummaryStats";
import { entities } from "@/data";
import { buildCalendarMonths, filterReleasesInRange } from "@/lib/calendar";
import { computeSummaryStats, getRangeBounds } from "@/lib/stats";
import { resolveTheme, themeToCssVars } from "@/lib/theme";

function todayNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function HomePage() {
  const [selectedEntityId, setSelectedEntityId] = useState(entities[0]?.id ?? "");
  const [selectedRange, setSelectedRange] = useState<1 | 3 | 6>(3);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [posterMode, setPosterMode] = useState(false);
  const exportTargetRef = useRef<HTMLDivElement>(null);

  const entity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) ?? entities[0],
    [selectedEntityId],
  );

  const theme = useMemo(() => resolveTheme(entity?.theme), [entity]);

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getRangeBounds(todayNoon(), selectedRange),
    [selectedRange],
  );

  const releasesInRange = useMemo(
    () => filterReleasesInRange(entity?.releases ?? [], rangeStart, rangeEnd),
    [entity, rangeStart, rangeEnd],
  );

  const stats = useMemo(
    () => computeSummaryStats(entity?.releases ?? [], rangeStart, rangeEnd),
    [entity, rangeStart, rangeEnd],
  );

  const calendarMonths = useMemo(
    () => buildCalendarMonths(rangeStart, rangeEnd, releasesInRange),
    [rangeStart, rangeEnd, releasesInRange],
  );

  const itemsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return releasesInRange.filter((r) => r.date === selectedDate);
  }, [releasesInRange, selectedDate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw.startsWith("feed-")) return;
    const rest = raw.slice("feed-".length);
    const byIdLen = [...entities].sort((a, b) => b.id.length - a.id.length);
    for (const e of byIdLen) {
      const prefix = `${e.id}-`;
      if (!rest.startsWith(prefix)) continue;
      const releaseId = rest.slice(prefix.length);
      const hit = e.releases.find((r) => r.id === releaseId);
      if (hit) {
        setSelectedEntityId(e.id);
        setSelectedDate(hit.date);
        break;
      }
    }
  }, []);

  if (!entity) {
    return null;
  }

  return (
    <div className="min-h-screen bg-page" style={themeToCssVars(theme)}>
      <div ref={exportTargetRef} className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 md:px-12">
        <div
          data-export-root
          className="space-y-10 rounded-2xl bg-page p-4 sm:p-6 md:p-8"
        >
          <Header
            entity={entity}
            daySpan={stats.daySpan}
            posterMode={posterMode}
          />

          <SummaryStats stats={stats} compact={selectedRange === 6} />

          <CalendarBoard
            months={calendarMonths}
            rangeMonths={selectedRange}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {!posterMode && (
          <div className="mt-8 flex flex-col gap-6 border-b border-white/5 pb-8 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4">
              <EntitySwitcher
                entities={entities}
                selectedId={entity.id}
                onChange={(id) => {
                  setSelectedEntityId(id);
                  setSelectedDate(null);
                }}
                posterMode={posterMode}
              />
              <RangeSwitcher
                value={selectedRange}
                onChange={(v) => {
                  setSelectedRange(v);
                  setSelectedDate(null);
                }}
                posterMode={posterMode}
              />
            </div>
            <div className="rounded-full bg-empty-cell/50 px-3 py-1 text-xs text-secondary ring-1 ring-white/5">
              Theme:{" "}
              <span className="font-medium text-accent">{entity.name}</span>
            </div>
          </div>
        )}

        <div className="mt-10 space-y-10 pb-24">
          <DayDetails
            dateStr={selectedDate}
            items={itemsForSelectedDay}
            posterMode={posterMode}
            entityId={entity.id}
          />

          <footer className="space-y-4 border-t border-white/5 pt-8 text-sm text-secondary/70">
            {entity.footnote && <p>{entity.footnote}</p>}
            <p>
              {entity.brandLine ?? "ReleaseLog"}
              {entity.brandUrl && (
                <>
                  {" · "}
                  <a
                    href={entity.brandUrl}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {entity.brandUrl.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
            </p>
            {!posterMode && (
              <div className="space-y-2 text-xs leading-relaxed">
                <p>
                  <Link
                    href="/subscribe"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    Subscribe
                  </Link>
                  <span className="text-secondary/80">
                    {" "}
                    — Atom feeds for each team (or all together); your reader stays in sync. Optional
                    weekly email when enabled.
                  </span>
                </p>
                <p className="text-secondary/70">
                  Share: screenshot this page or use Export PNG (header, stats, and calendar only).
                </p>
              </div>
            )}
          </footer>
        </div>
      </div>

      {!posterMode && (
        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-8 md:px-12">
          <PosterToolbar
            posterMode={posterMode}
            onPosterModeChange={setPosterMode}
            exportTargetRef={exportTargetRef}
          />
        </div>
      )}

      {posterMode && (
        <PosterToolbar
          posterMode={posterMode}
          onPosterModeChange={setPosterMode}
          exportTargetRef={exportTargetRef}
        />
      )}
    </div>
  );
}

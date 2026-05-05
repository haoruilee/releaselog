"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarBoard } from "@/components/CalendarBoard";
import { DayDetails } from "@/components/DayDetails";
import { EntitySwitcher } from "@/components/EntitySwitcher";
import { Header } from "@/components/Header";
import { PosterToolbar } from "@/components/PosterToolbar";
import { RangeSwitcher } from "@/components/RangeSwitcher";
import { SummaryStats } from "@/components/SummaryStats";
import { entityMetas } from "@/data";
import type { ReleaseItem } from "@/data/types";
import { buildCalendarMonths, filterReleasesInRange } from "@/lib/calendar";
import { computeSummaryStats, getRangeBounds } from "@/lib/stats";
import { resolveTheme, themeToCssVars } from "@/lib/theme";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const USE_SERVER_DATA = process.env.NEXT_PUBLIC_USE_SERVER_DATA !== "0";

function todayNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Props {
  initialEntityId?: string;
}

export default function HomeClient({ initialEntityId }: Props) {
  const router = useRouter();
  const [selectedEntityId, setSelectedEntityId] = useState(
    initialEntityId ?? entityMetas[0]?.id ?? "",
  );
  const [selectedRange, setSelectedRange] = useState<1 | 3 | 6>(3);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [posterMode, setPosterMode] = useState(false);

  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const pendingReleaseIdRef = useRef<string | null>(null);

  const exportTargetRef = useRef<HTMLDivElement>(null);

  const entityMeta = useMemo(
    () => entityMetas.find((e) => e.id === selectedEntityId) ?? entityMetas[0],
    [selectedEntityId],
  );

  const theme = useMemo(() => resolveTheme(entityMeta?.theme), [entityMeta]);

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getRangeBounds(todayNoon(), selectedRange),
    [selectedRange],
  );
  const todayKey = useMemo(() => dateKey(todayNoon()), []);

  useEffect(() => {
    setReleases([]);
    const endpoint = USE_SERVER_DATA
      ? `${BASE_PATH}/api/v1/entity-releases/${selectedEntityId}`
      : `${BASE_PATH}/data/${selectedEntityId}-releases.json`;
    fetch(endpoint)
      .then((r) => r.json())
      .then((data: ReleaseItem[] | { releases?: ReleaseItem[] }) => {
        const releasesList = Array.isArray(data) ? data : data.releases ?? [];
        setReleases(releasesList);
        if (pendingReleaseIdRef.current) {
          const hit = releasesList.find((r) => r.id === pendingReleaseIdRef.current);
          if (hit) setSelectedDate(hit.date);
          pendingReleaseIdRef.current = null;
        }
      })
      .catch(() => setReleases([]));
  }, [selectedEntityId]);

  // Hash-based deep linking: #feed-{entityId}-{releaseId}
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw.startsWith("feed-")) return;
    const rest = raw.slice("feed-".length);
    const byIdLen = [...entityMetas].sort((a, b) => b.id.length - a.id.length);
    for (const e of byIdLen) {
      const prefix = `${e.id}-`;
      if (!rest.startsWith(prefix)) continue;
      const releaseId = rest.slice(prefix.length);
      pendingReleaseIdRef.current = releaseId;
      setSelectedEntityId(e.id);
      router.push(`/${e.id}`);
      break;
    }
  }, [router]);

  const releasesInRange = useMemo(
    () => filterReleasesInRange(releases, rangeStart, rangeEnd),
    [releases, rangeStart, rangeEnd],
  );

  const stats = useMemo(
    () => computeSummaryStats(releases, rangeStart, rangeEnd),
    [releases, rangeStart, rangeEnd],
  );

  const calendarMonths = useMemo(
    () => buildCalendarMonths(rangeStart, rangeEnd, releasesInRange),
    [rangeStart, rangeEnd, releasesInRange],
  );

  const itemsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return releasesInRange.filter((r) => r.date === selectedDate);
  }, [releasesInRange, selectedDate]);

  if (!entityMeta) return null;

  return (
    <div className="min-h-screen bg-page" style={themeToCssVars(theme)}>
      <div ref={exportTargetRef} className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 md:px-12">
        <div
          data-export-root
          className="space-y-10 rounded-2xl bg-page p-4 sm:p-6 md:p-8"
        >
          <Header
            entity={entityMeta}
            daySpan={stats.daySpan}
            posterMode={posterMode}
          />

          <SummaryStats stats={stats} compact={selectedRange === 6} />

          <CalendarBoard
            months={calendarMonths}
            rangeMonths={selectedRange}
            selectedDate={selectedDate}
            todayKey={todayKey}
            onSelectDate={setSelectedDate}
          />
        </div>

        {!posterMode && (
          <div className="mt-8 flex flex-col gap-6 border-b border-white/5 pb-8 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4">
              <EntitySwitcher
                entities={entityMetas}
                selectedId={entityMeta.id}
                onChange={(id) => {
                  setSelectedEntityId(id);
                  setSelectedDate(null);
                  router.push(`/${id}`);
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
              <span className="font-medium text-accent">{entityMeta.name}</span>
            </div>
          </div>
        )}

        <div className="mt-10 pb-24">
          <footer className="space-y-4 border-t border-white/5 pt-8 text-sm text-secondary/70">
            {entityMeta.footnote && <p>{entityMeta.footnote}</p>}
            <p>
              {entityMeta.brandLine ?? "ReleaseLog"}
              {entityMeta.brandUrl && (
                <>
                  {" · "}
                  <a
                    href={entityMeta.brandUrl}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {entityMeta.brandUrl.replace(/^https?:\/\//, "")}
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

      {!posterMode && selectedDate && itemsForSelectedDay.length > 0 && (
        <DayDetails
          dateStr={selectedDate}
          items={itemsForSelectedDay}
          onClose={() => setSelectedDate(null)}
          entityId={entityMeta.id}
        />
      )}
    </div>
  );
}

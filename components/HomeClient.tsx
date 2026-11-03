"use client";

import { AdPlacement } from "./Advertising";
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
import { useT } from "@/components/I18nProvider";

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
  const t = useT();
  const [selectedEntityId, setSelectedEntityId] = useState(
    initialEntityId ?? entityMetas[0]?.id ?? "",
  );
  const [selectedRange, setSelectedRange] = useState<1 | 3 | 6>(3);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [posterMode, setPosterMode] = useState(false);

  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
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
    const controller = new AbortController();
    setReleases([]);
    setLoading(true);
    setLoadError(false);
    const endpoint = USE_SERVER_DATA
      ? `${BASE_PATH}/api/v1/entity-releases/${selectedEntityId}`
      : `${BASE_PATH}/data/${selectedEntityId}-releases.json`;
    fetch(endpoint, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("release_fetch_failed"); return r.json(); })
      .then((data: ReleaseItem[] | { releases?: ReleaseItem[] }) => {
        if (controller.signal.aborted) return;
        const releasesList = Array.isArray(data) ? data : data.releases ?? [];
        setReleases(releasesList);
        if (pendingReleaseIdRef.current) {
          const hit = releasesList.find((r) => r.id === pendingReleaseIdRef.current);
          if (hit) setSelectedDate(hit.date);
          pendingReleaseIdRef.current = null;
        }
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedEntityId, retry]);

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
    <div data-poster-mode={posterMode} className="min-h-screen bg-page" style={themeToCssVars(theme)}>
      <div ref={exportTargetRef} className="mx-auto max-w-[1344px] px-6 pt-8 sm:px-10 sm:pt-10 lg:px-12">
        <div className={posterMode ? "block" : "grid gap-8 lg:grid-cols-[208px_minmax(0,1fr)]"}>
          {!posterMode && <aside data-export-exclude className="hidden lg:block"><div className="sticky top-6"><EntitySwitcher variant="sidebar" entities={entityMetas} selectedId={entityMeta.id} onChange={id => { setSelectedEntityId(id); setSelectedDate(null); router.push(`/${id}`); }} posterMode={posterMode} /></div></aside>}
          <div className="min-w-0">
        <div
          data-export-root
          className="space-y-7 bg-page"
        >
          <Header
            entity={entityMeta}
            daySpan={stats.daySpan}
            posterMode={posterMode}
          />

          {!posterMode && (
            <div
              data-export-exclude
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4"
            >
              <div className="lg:hidden"><EntitySwitcher entities={entityMetas} selectedId={entityMeta.id} onChange={id => { setSelectedEntityId(id); setSelectedDate(null); router.push(`/${id}`); }} posterMode={posterMode} /></div>
              <RangeSwitcher
                value={selectedRange}
                onChange={value => { setSelectedRange(value); setSelectedDate(null); }}
                posterMode={posterMode}
              />
              <PosterToolbar posterMode={posterMode} onPosterModeChange={setPosterMode} exportTargetRef={exportTargetRef} />
            </div>
          )}

          <SummaryStats stats={stats} compact={selectedRange === 6} loading={loading} />

          {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{t("site.load_error")}</p><button type="button" onClick={() => setRetry(v => v + 1)} className="rounded-md border border-red-300 px-4 py-2 font-medium">{t("site.retry")}</button></div>}

          <CalendarBoard
            months={calendarMonths}
            rangeMonths={selectedRange}
            selectedDate={selectedDate}
            todayKey={todayKey}
            onSelectDate={setSelectedDate}
          />
          {!posterMode && <AdPlacement position="calendar-banner" />}
          {!posterMode && <section data-export-exclude className="pb-4" aria-busy={loading}>
            <h2 className="font-serif text-3xl text-primary">{t("site.recent")}</h2>
            {loading ? <p role="status" className="py-8 text-sm text-secondary">{t("site.loading")}</p> : !loadError && releasesInRange.length === 0 ? <p className="py-8 text-sm text-secondary">{t("site.no_releases")}</p> : <ol className="mt-5 divide-y divide-slate-200 border-y border-slate-200">{[...releasesInRange].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(item => <li key={item.id} className="grid gap-2 py-4 sm:grid-cols-[120px_1fr_auto] sm:gap-6"><time dateTime={item.date} className="text-xs text-secondary sm:pt-1">{item.date}</time><button type="button" data-release-row onClick={() => setSelectedDate(item.date)} className="text-left text-sm font-medium leading-relaxed text-primary hover:text-accent">{item.title}</button>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent sm:pt-1">{t("site.source")} ↗</a>}</li>)}</ol>}
          </section>}
        </div>

        <div className="mt-8 pb-12">
          <footer className="space-y-4 border-t border-slate-200 pt-8 text-sm text-secondary">
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
                    {t("footer.subscribe_label")}
                  </Link>
                  <span className="text-secondary">
                    {t("footer.subscribe_intro")}
                  </span>
                </p>
                <p className="text-secondary">
                  {t("footer.share_hint")}
                </p>
              </div>
            )}
          </footer>
        </div>
          </div>
        </div>
      </div>

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

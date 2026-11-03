"use client";

import type { SummaryStats as SummaryStatsType } from "@/lib/stats";
import { useT } from "@/components/I18nProvider";

type Props = {
  stats: SummaryStatsType;
  compact?: boolean;
  loading?: boolean;
};

export function SummaryStats({ stats, loading }: Props) {
  const t = useT();
  const items = [
    { label: t("stats.total_logs"), value: stats.totalItems },
    { label: t("stats.releases"), value: stats.totalReleases },
    { label: t("stats.events"), value: stats.totalEvents },
    { label: t("stats.active_days"), value: stats.activeDays },
    { label: t("stats.avg_per_week"), value: stats.avgPerWeek },
  ];

  return (
    <div className="grid grid-cols-3 gap-y-3 border-y border-slate-200 py-5 sm:grid-cols-5" aria-busy={loading}>
      {items.map((item) => (
        <div
          key={item.label}
          className="border-r border-slate-200 px-4 first:pl-0 last:border-r-0 sm:px-5"
        >
          <p className="text-xs text-secondary sm:text-sm">
            {item.label}
          </p>
          <p className="mt-1 font-serif text-[30px] text-primary tabular-nums">
            {loading ? "—" : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

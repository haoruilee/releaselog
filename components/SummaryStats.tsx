import type { SummaryStats as SummaryStatsType } from "@/lib/stats";

type Props = {
  stats: SummaryStatsType;
  compact?: boolean;
};

export function SummaryStats({ stats, compact }: Props) {
  const items = [
    { label: "Total releases", value: stats.totalReleases },
    { label: "Active shipping days", value: stats.activeDays },
    { label: "Avg / week", value: stats.avgPerWeek },
  ];

  return (
    <div
      className={`grid gap-4 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-panel/80 px-4 py-3 ring-1 ring-white/5"
        >
          <p className="text-xs uppercase tracking-wide text-secondary">
            {item.label}
          </p>
          <p className="mt-1 font-serif text-3xl text-accent-number tabular-nums">
            {item.value}
          </p>
        </div>
      ))}
      {!compact && stats.busiestMonthLabel && (
        <div className="rounded-xl bg-panel/80 px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs uppercase tracking-wide text-secondary">
            Busiest month
          </p>
          <p className="mt-1 text-lg font-medium text-primary">
            {stats.busiestMonthLabel}
          </p>
        </div>
      )}
    </div>
  );
}

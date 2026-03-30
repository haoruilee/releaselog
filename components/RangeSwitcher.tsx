"use client";

type Range = 1 | 3 | 6;

type Props = {
  value: Range;
  onChange: (v: Range) => void;
  posterMode: boolean;
};

const options: { value: Range; label: string }[] = [
  { value: 1, label: "1M" },
  { value: 3, label: "3M" },
  { value: 6, label: "6M" },
];

export function RangeSwitcher({ value, onChange, posterMode }: Props) {
  if (posterMode) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-secondary/80">
        Range
      </span>
      <div className="inline-flex rounded-full bg-empty-cell p-1 ring-1 ring-white/5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                active
                  ? "bg-panel text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

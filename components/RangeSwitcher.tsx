"use client";

import { useT } from "@/components/I18nProvider";

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
  const t = useT();
  if (posterMode) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("switcher.range")}>
      <span className="sr-only">
        {t("switcher.range")}
      </span>
      <div className="inline-flex rounded-md bg-empty-cell p-1 ring-1 ring-slate-200">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
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

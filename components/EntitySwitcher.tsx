"use client";

import type { EntityConfig } from "@/data/types";

type Props = {
  entities: EntityConfig[];
  selectedId: string;
  onChange: (id: string) => void;
  posterMode: boolean;
};

export function EntitySwitcher({
  entities,
  selectedId,
  onChange,
  posterMode,
}: Props) {
  if (posterMode) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-secondary/80">
        Team / product
      </span>
      <div className="flex flex-wrap gap-2">
        {entities.map((e) => {
          const active = e.id === selectedId;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onChange(e.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-active-cell text-primary shadow-sm ring-1 ring-white/10"
                  : "bg-empty-cell text-secondary hover:bg-panel hover:text-primary"
              }`}
            >
              {e.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

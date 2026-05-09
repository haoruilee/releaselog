"use client";

import Link from "next/link";
import type { EntityMeta } from "@/data/types";
import { useT } from "@/components/I18nProvider";

type Props = {
  entities: EntityMeta[];
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
  const t = useT();
  if (posterMode) return null;

  const renderEntityButton = (e: EntityMeta) => {
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
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-secondary/80">
        {t("switcher.team_product")}
      </span>
      <div className="flex flex-wrap gap-2">
        {entities.slice(0, 1).map(renderEntityButton)}
        <Link
          href="/reset-log"
          className="rounded-full bg-empty-cell px-4 py-1.5 text-sm font-medium text-secondary transition-colors hover:bg-panel hover:text-primary"
        >
          {t("switcher.reset_log")}
        </Link>
        {entities.slice(1).map(renderEntityButton)}
      </div>
    </div>
  );
}

"use client";

import type { EntityMeta } from "@/data/types";
import { useT } from "@/components/I18nProvider";

type Props = {
  entities: EntityMeta[];
  selectedId: string;
  onChange: (id: string) => void;
  posterMode: boolean;
  variant?: "sidebar" | "select";
};

export function EntitySwitcher({
  entities,
  selectedId,
  onChange,
  posterMode,
  variant = "select",
}: Props) {
  const t = useT();
  if (posterMode) return null;

  const renderEntityButton = (e: EntityMeta) => {
    const active = e.id === selectedId;
    return (
      <button
        key={e.id}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(e.id)}
        className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
          active
            ? "border-orange-200 bg-orange-50 text-accent"
            : "border-slate-200 bg-white text-secondary hover:bg-panel hover:text-primary"
        }`}
      >
        {e.name}
      </button>
    );
  };

  if (variant === "sidebar") return (
    <nav aria-label={t("switcher.team_product")} data-team-sidebar>
      <h2 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-secondary">{t("switcher.team_product")}</h2>
      <div className="flex flex-col gap-1.5">{entities.map(renderEntityButton)}</div>
    </nav>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="sr-only">
        {t("switcher.team_product")}
      </span>
      <select aria-label={t("site.all_teams")} value={selectedId} onChange={event => onChange(event.target.value)} className="min-h-10 w-[160px] max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-secondary xl:max-w-[160px]">
        {entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
      </select>
    </div>
  );
}

"use client";

import type { EntityMeta } from "@/data/types";
import { useT } from "@/components/I18nProvider";

type Props = {
  entity: EntityMeta;
  daySpan: number;
  posterMode: boolean;
};

export function Header({ entity, daySpan, posterMode }: Props) {
  const t = useT();

  // Headline tokens come from the entity JSON in English; we fall back to a
  // localized template (with `{name}` / `{days}` interpolated) when the
  // entity didn't override it. Translating per-entity copy is intentionally
  // out of scope (event content stays in source language).
  const headline =
    entity.headline?.replace("{name}", entity.name).replace("{days}", String(daySpan)) ??
    t("headline.default", { name: entity.name, days: daySpan });

  const parts = headline.split(entity.name);
  const hasSplit = parts.length > 1;

  return (
    <header className="space-y-4">
      <h1 className="editorial-title max-w-6xl text-4xl text-primary sm:text-[48px] lg:text-[52px]">
        {hasSplit ? (
          <>
            {parts[0]}
            <span>{entity.name}</span>
            {parts.slice(1).join(entity.name)}
          </>
        ) : (
          headline
        )}
      </h1>

      {(entity.subtitle || entity.description) && (
        <p className="max-w-5xl text-base leading-relaxed text-secondary sm:text-[17px]">
          {entity.description ?? entity.subtitle}
        </p>
      )}

      {entity.members && entity.members.length > 0 && !posterMode && (
        <section className="pt-1">
          <h3 className="sr-only">
            {t("header.team_members")}
          </h3>
          <div className="flex flex-wrap gap-4">
          {entity.members.map((m) => (
            <div key={m.name + (m.handle ?? "")} className="flex items-center gap-2">
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(process.env.NEXT_PUBLIC_BASE_PATH ?? "") + m.avatar}
                  alt={`${m.name} avatar`}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-empty-cell text-xs text-secondary ring-1 ring-slate-200">
                  {m.name.slice(0, 1)}
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-primary">{m.name}</p>
                {m.handle && (
                  <p className="text-xs text-secondary">{m.handle}</p>
                )}
              </div>
            </div>
          ))}
          </div>
        </section>
      )}
    </header>
  );
}

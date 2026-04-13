"use client";

import { format } from "date-fns";
import type { ReleaseItem } from "@/data/types";
import { getSourceLabel } from "@/lib/source-label";

type Props = {
  dateStr: string | null;
  items: ReleaseItem[];
  posterMode: boolean;
  /** Used for /subscribe feed deep links: `/?entity=…#feed-{entityId}-{releaseId}` */
  entityId?: string;
};

export function DayDetails({ dateStr, items, posterMode, entityId }: Props) {
  if (posterMode) return null;

  if (!dateStr || items.length === 0) {
    return (
      <section className="rounded-2xl bg-panel/60 p-6 ring-1 ring-white/5">
        <p className="text-sm text-secondary">
          Select a day on the calendar to see full release details.
        </p>
      </section>
    );
  }

  const d = new Date(dateStr + "T12:00:00");

  return (
    <section className="rounded-2xl bg-panel/80 p-6 ring-1 ring-white/10">
      <h3 className="font-serif text-2xl text-primary">
        {format(d, "EEEE, MMMM d, yyyy")}
      </h3>
      <ul className="mt-4 space-y-4">
        {items.map((item) => {
          const sourceLabel = item.sourceUrl
            ? getSourceLabel(item.sourceUrl)
            : null;
          const audiences = item.audience
            ? Array.isArray(item.audience)
              ? item.audience
              : [item.audience]
            : [];

          const anchorId =
            entityId !== undefined ? `feed-${entityId}-${item.id}` : undefined;

          return (
            <li
              key={item.id}
              id={anchorId}
              className="scroll-mt-24 border-b border-white/5 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className="font-medium text-primary">{item.title}</p>
                )}
                {item.status && item.status !== "stable" && (
                  <span className="rounded bg-empty-cell/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary">
                    {item.status}
                  </span>
                )}
              </div>
              {item.whatChanged && (
                <p className="mt-2 text-sm font-medium leading-snug text-primary/90">
                  {item.whatChanged}
                </p>
              )}
              {item.description && (
                <p className="mt-1 text-sm leading-relaxed text-secondary">
                  {item.description}
                </p>
              )}
              {audiences.length > 0 && (
                <p className="mt-2 text-xs text-secondary/80">
                  For: {audiences.join(", ").replaceAll("_", " ")}
                </p>
              )}
              {item.howTo &&
                (item.howTo.prerequisites?.length || item.howTo.steps.length) && (
                  <div className="mt-3 rounded-xl bg-empty-cell/40 px-3 py-2 ring-1 ring-white/5">
                    {item.howTo.prerequisites &&
                      item.howTo.prerequisites.length > 0 && (
                        <p className="text-xs font-medium text-secondary">
                          Before: {item.howTo.prerequisites.join(" · ")}
                        </p>
                      )}
                    {item.howTo.steps.length > 0 && (
                      <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-sm text-primary/90">
                        {item.howTo.steps.map((step, i) => (
                          <li key={i} className="leading-relaxed">
                            {step}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              {item.docUrls && item.docUrls.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {item.docUrls.map((u) => (
                    <li key={u}>
                      <a
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        {getSourceLabel(u)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-empty-cell px-2 py-0.5 text-xs text-secondary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {item.sourceUrl && sourceLabel && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-accent underline-offset-4 hover:underline"
                >
                  {sourceLabel}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

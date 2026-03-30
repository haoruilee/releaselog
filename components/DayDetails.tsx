"use client";

import { format } from "date-fns";
import type { ReleaseItem } from "@/data/types";

type Props = {
  dateStr: string | null;
  items: ReleaseItem[];
  posterMode: boolean;
};

export function DayDetails({ dateStr, items, posterMode }: Props) {
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
        {items.map((item) => (
          <li
            key={item.id}
            className="border-b border-white/5 pb-4 last:border-0 last:pb-0"
          >
            <p className="font-medium text-primary">{item.title}</p>
            {item.description && (
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                {item.description}
              </p>
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
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-accent underline-offset-4 hover:underline"
              >
                Source
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

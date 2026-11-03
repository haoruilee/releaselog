"use client";

import { useEffect, useId, useRef } from "react";
import { format } from "date-fns";
import type { ReleaseItem } from "@/data/types";
import { getSourceLabel } from "@/lib/source-label";
import { useT } from "@/components/I18nProvider";

type Props = {
  dateStr: string | null;
  items: ReleaseItem[];
  onClose: () => void;
  /** Used for /subscribe feed deep links: `/?entity=…#feed-{entityId}-{releaseId}` */
  entityId?: string;
};

export function DayDetails({ dateStr, items, onClose, entityId }: Props) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);

  if (!dateStr || items.length === 0) return null;

  const d = new Date(dateStr + "T12:00:00");

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')];
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} className="m-auto max-h-[85dvh] w-[calc(100%_-_32px)] max-w-2xl rounded-xl border border-slate-200 bg-white p-0 shadow-2xl">
      {/* Panel */}
      <div className="relative w-full bg-white">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-2xl bg-panel/95 px-6 py-4 backdrop-blur-sm border-b border-slate-200">
          <h3 id={titleId} className="font-serif text-2xl text-primary">
            {format(d, "EEEE, MMMM d, yyyy")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("day.close")}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-secondary hover:bg-empty-cell hover:text-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M12 4 4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
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
                entityId !== undefined
                  ? `feed-${entityId}-${item.id}`
                  : undefined;

              return (
                <li
                  key={item.id}
                  id={anchorId}
                  className="scroll-mt-24 border-b border-slate-200 pb-4 last:border-0 last:pb-0"
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
                    {item.kind === "event" && (
                      <span className="rounded-full bg-empty-cell/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent ring-1 ring-slate-200">
                        {t("day.event_badge")}
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
                    <p className="mt-2 text-xs text-secondary">
                      {t("day.for")} {audiences.join(", ").replaceAll("_", " ")}
                    </p>
                  )}
                  {item.howTo &&
                    (item.howTo.prerequisites?.length ||
                      item.howTo.steps.length) && (
                      <div className="mt-3 rounded-xl bg-empty-cell/40 px-3 py-2 ring-1 ring-slate-200">
                        {item.howTo.prerequisites &&
                          item.howTo.prerequisites.length > 0 && (
                            <p className="text-xs font-medium text-secondary">
                              {t("day.before")}{" "}
                              {item.howTo.prerequisites.join(" · ")}
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
        </div>
      </div>
    </dialog>
  );
}

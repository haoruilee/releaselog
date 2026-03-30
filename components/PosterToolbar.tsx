"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { exportElementAsPng } from "@/lib/export";

type Props = {
  posterMode: boolean;
  onPosterModeChange: (v: boolean) => void;
  exportTargetRef: RefObject<HTMLElement | null>;
};

export function PosterToolbar({
  posterMode,
  onPosterModeChange,
  exportTargetRef,
}: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    const el = exportTargetRef.current?.querySelector("[data-export-root]") as
      | HTMLElement
      | undefined;
    if (!el) return;
    setExporting(true);
    try {
      await exportElementAsPng(el, `releaselog-${Date.now()}.png`);
    } finally {
      setExporting(false);
    }
  }

  if (posterMode) {
    return (
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-full bg-panel/95 px-4 py-2 shadow-lg ring-1 ring-white/10 backdrop-blur">
        <button
          type="button"
          onClick={() => onPosterModeChange(false)}
          className="rounded-full px-4 py-2 text-sm font-medium text-primary ring-1 ring-white/15 hover:bg-empty-cell"
        >
          Exit poster mode
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-full bg-active-cell px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export PNG"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => onPosterModeChange(true)}
        className="rounded-full bg-empty-cell px-4 py-2 text-sm font-medium text-secondary ring-1 ring-white/10 transition-colors hover:text-primary"
      >
        Poster mode
      </button>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="rounded-full bg-panel px-4 py-2 text-sm font-medium text-primary ring-1 ring-white/10 hover:bg-empty-cell disabled:opacity-50"
      >
        {exporting ? "Exporting…" : "Export PNG"}
      </button>
      <p className="text-xs text-secondary/70">
        Poster mode hides controls for a clean capture.
      </p>
    </div>
  );
}

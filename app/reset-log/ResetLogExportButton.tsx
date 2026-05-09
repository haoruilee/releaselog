"use client";

import { useState } from "react";
import { exportElementAsPng } from "@/lib/export";
import { useT } from "@/components/I18nProvider";

interface Props {
  filenamePrefix?: string;
  className?: string;
}

export function ResetLogExportButton({
  filenamePrefix = "reset-log",
  className,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const t = useT();

  async function handleExport() {
    if (typeof document === "undefined") return;
    const el = document.querySelector(
      "[data-export-root]",
    ) as HTMLElement | null;
    if (!el) return;
    setExporting(true);
    try {
      const name = `${filenamePrefix}-${Date.now()}.png`;
      await exportElementAsPng(el, name);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className={
        className ??
        "rounded-full bg-[var(--bg-empty-cell)] px-3 py-1.5 text-xs font-medium text-secondary ring-1 ring-black/10 transition-colors hover:bg-[var(--bg-active-cell)] hover:text-primary disabled:opacity-50"
      }
      aria-label={t("poster.export_aria")}
    >
      {exporting ? t("poster.exporting") : t("poster.export")}
    </button>
  );
}

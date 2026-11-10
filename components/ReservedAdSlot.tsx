"use client";

import { useEffect, useRef } from "react";
import publisherConfig from "@/publisher-config.json";
import { canRequestAds, type AdSlotKey, type PublisherConfig } from "@/lib/adsense-gate";
import { useT } from "@/components/I18nProvider";

type Props = {
  slotKey: AdSlotKey;
  className?: string;
};

function readAdConsentSignal(): unknown {
  if (typeof window === "undefined") return null;
  const host = window as Window & { __RELEASELOG_AD_CONSENT__?: unknown };
  return host.__RELEASELOG_AD_CONSENT__;
}

/**
 * Inserts the AdSense loader only after canRequestAds returns ok.
 * With the shipped config this function is never called.
 */
function activateAdSlot(root: HTMLElement, clientId: string, slotId: string) {
  if (root.querySelector("ins.adsbygoogle")) return;

  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.setAttribute("data-ad-client", clientId);
  ins.setAttribute("data-ad-slot", slotId);
  root.appendChild(ins);

  const scriptId = "releaselog-adsense-sdk";
  if (!document.getElementById(scriptId)) {
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(clientId);
    document.head.appendChild(script);
  }

  const adsWindow = window as Window & { adsbygoogle?: unknown[] };
  adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
  adsWindow.adsbygoogle.push({});
  root.dataset.adState = "requested";
}

export function ReservedAdSlot({ slotKey, className }: Props) {
  const t = useT();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const decision = canRequestAds(
      publisherConfig as PublisherConfig,
      slotKey,
      readAdConsentSignal(),
    );
    if (!decision.ok) return;
    activateAdSlot(root, decision.clientId, decision.slotId);
  }, [slotKey]);

  return (
    <aside
      ref={rootRef}
      data-ad-slot-key={slotKey}
      data-ad-state="reserved"
      data-export-exclude
      aria-label={t("ads.label")}
      className={[
        "rounded-2xl bg-panel/40 px-4 py-3 ring-1 ring-white/5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
        {t("ads.label")}
      </p>
      <p className="mt-1 text-xs text-secondary/80">{t("ads.reserved")}</p>
    </aside>
  );
}

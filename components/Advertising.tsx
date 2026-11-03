"use client";
import { createContext, useContext, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdvertisingConfig, AdPosition } from "@/lib/advertising";
import { useT } from "./I18nProvider";
const Context = createContext<AdvertisingConfig | null>(null);
declare global { interface Window { adsbygoogle?: Record<string, unknown>[] } }
const isEditorial = (path: string | null) => !/^\/(admin|login|subscribe|api)(\/|$)/.test(path || "/");
export function AdvertisingProvider({ config, children }: { config: AdvertisingConfig; children: React.ReactNode }) {
  const pathname = usePathname();
  return <Context.Provider value={config}>{config.client && isEditorial(pathname) && <Script id="releaselog-adsense" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`} strategy="afterInteractive" crossOrigin="anonymous" />}{children}</Context.Provider>;
}
function GoogleUnit({ client, slot }: { client: string; slot: string }) {
  const element = useRef<HTMLModElement>(null); const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current || !element.current || element.current.getAttribute("data-adsbygoogle-status")) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); pushed.current = true; } catch { /* A blocked ad never blocks the editorial page. */ }
  }, [client, slot]);
  return <ins ref={element} className="adsbygoogle block min-h-[100px] w-full" data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />;
}
export function AdPlacement({ position, className = "" }: { position: AdPosition; className?: string }) {
  const c = useContext(Context); const t = useT(); const pathname = usePathname();
  if (!c || !isEditorial(pathname)) return null;
  const activeGoogle = c.client && c.slots[position];
  return <aside aria-label={t("ads.label")} data-ad-placement={position} data-export-exclude className={`overflow-hidden rounded-lg ${activeGoogle || c.sponsor ? "border border-slate-200 bg-white" : "bg-orange-50/70"} ${className}`}>
    {(activeGoogle || c.sponsor) && <div className="px-4 pt-3 text-[10px] uppercase tracking-[0.2em] text-secondary">{t("ads.label")}</div>}
    {activeGoogle ? <GoogleUnit key={`${c.client}:${c.slots[position]}`} client={c.client} slot={c.slots[position]} /> : c.sponsor ? <a href={c.sponsor.url} target="_blank" rel="sponsored noopener noreferrer" className="flex min-h-[100px] items-center justify-between gap-4 px-5 py-4 text-primary">
      <span className="min-w-0"><span className="block truncate font-serif text-xl">{c.sponsor.name}</span><span className="mt-1 block text-xs text-secondary">{t("ads.partner")}</span></span>
      {c.sponsor.image ? <img src={c.sponsor.image} alt={c.sponsor.name} loading="lazy" className="h-16 w-32 shrink-0 object-contain" /> : <span aria-hidden>↗</span>}
    </a> : <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3"><div className="flex flex-wrap items-center gap-x-5 gap-y-1"><p className="font-serif text-lg text-primary">{t("ads.headline")}</p><p className="hidden text-xs leading-relaxed text-secondary lg:block">{t("ads.description")}</p></div><Link href="/advertise" className="shrink-0 py-2 text-xs font-medium text-accent hover:underline">{t("ads.learn_more")} ↗</Link></div>}
  </aside>;
}
export function SiteSponsorFooter() {
  const pathname = usePathname();
  if (!isEditorial(pathname) || pathname === "/advertise") return null;
  return <div className="mx-auto max-w-[1344px] px-6 pb-8 sm:px-10 lg:px-12"><AdPlacement position="site-footer" /></div>;
}

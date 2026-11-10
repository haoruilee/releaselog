"use client";
import { usePathname } from "next/navigation";
import type { AdvertisingConfig, AdPosition } from "@/lib/advertising";
import { ReservedAdSlot } from "./ReservedAdSlot";
import { AD_SLOT_KEYS, type AdSlotKey } from "@/lib/adsense-gate";

const isEditorial = (path: string | null) => !/^\/(admin|login|subscribe|privacy|api)(\/|$)/.test(path || "/");
const slots: Record<AdPosition, AdSlotKey> = {
  "calendar-banner": AD_SLOT_KEYS.homeBanner,
  "reset-banner": AD_SLOT_KEYS.articleInContent,
  "site-footer": AD_SLOT_KEYS.contentFooter,
};
export function AdvertisingProvider({ children }: { config: AdvertisingConfig; children: React.ReactNode }) {
  return <>{children}</>;
}
export function AdPlacement({ position, className = "" }: { position: AdPosition; className?: string }) {
  const pathname = usePathname();
  if (!isEditorial(pathname)) return null;
  return <ReservedAdSlot slotKey={slots[position]} className={className} />;
}
export function SiteSponsorFooter() {
  const pathname = usePathname();
  if (!isEditorial(pathname) || pathname === "/advertise") return null;
  return <div className="mx-auto max-w-[1344px] px-6 pb-8 sm:px-10 lg:px-12"><AdPlacement position="site-footer" /></div>;
}

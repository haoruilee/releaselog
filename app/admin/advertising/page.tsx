import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/runtime-config";
import { AD_POSITIONS, getAdvertisingConfig } from "@/lib/advertising";
export const dynamic = "force-dynamic";
export default async function AdvertisingAdminPage() {
  const current = await getCurrentUser(); if (!current) redirect("/login?next=/admin/advertising"); if (!isAdminEmail(current.user.email)) redirect("/subscribe");
  const c = getAdvertisingConfig();
  return <main className="mx-auto max-w-5xl px-5 py-12"><Link href="/admin/monitor" className="text-sm text-accent">← Admin monitor</Link><h1 className="mt-6 font-serif text-4xl">Advertising readiness</h1><p className="mt-4 text-secondary">AdSense and direct sponsorship are prepared. Empty placements show a sponsorship invitation; no Google advertising request is made without a valid publisher ID.</p>
    <dl className="mt-8 grid gap-4 sm:grid-cols-2"><div>Publisher: {c.client || "Not configured"}</div><div>Direct sponsor: {c.sponsor?.name || "Not configured"}</div>{AD_POSITIONS.map(p=><div key={p} className="rounded-lg border border-slate-200 p-4">{p}<br/><span className="text-secondary">{c.slots[p] || "Ready · awaiting slot ID"}</span></div>)}</dl>
    <h2 className="mt-10 text-xl">Configuration to provide</h2><pre className="mt-4 overflow-x-auto rounded-lg bg-panel p-5 text-xs leading-6">{`ADSENSE_CLIENT_ID=ca-pub-…\nADSENSE_SLOT_CALENDAR=…\nADSENSE_SLOT_RESET=…\nADSENSE_SLOT_FOOTER=…\nAD_CONTACT_EMAIL=${c.contactEmail}\n\n# Optional direct sponsorship\nSPONSOR_NAME=…\nSPONSOR_URL=https://…\nSPONSOR_IMAGE_URL=https://…`}</pre><p className="mt-4 text-sm text-secondary">Use the deployment environment; no frontend rebuild is required for these runtime settings. /ads.txt is published only after a valid publisher ID is configured. Sponsor links are marked sponsored. Sponsored content does not alter editorial review.</p><Link href="/advertise" className="mt-6 inline-block text-accent">Public sponsorship page ↗</Link></main>;
}

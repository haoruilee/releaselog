import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n";
import { getAdvertisingConfig } from "@/lib/advertising";
export const metadata = { title: "Advertise & sponsor · ReleaseLog", description: "Reach developers following AI launches, coding tools, and usage-limit updates." };
export default async function AdvertisePage() {
  const { t } = await getServerTranslator(); const config = getAdvertisingConfig();
  return <main className="mx-auto max-w-[1248px] px-6 pb-16 pt-10 sm:px-10"><Link href="/" className="text-xs text-secondary">← ReleaseLog</Link><p className="mt-8 text-xs uppercase tracking-[0.24em] text-accent">{t("ads.open")}</p><h1 className="mt-4 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">{t("ads.media_title")}</h1><p className="mt-6 max-w-2xl text-secondary">{t("ads.media_description")}</p>
    <div className="mt-12 grid gap-4 sm:grid-cols-3">{["calendar", "reset", "footer"].map((key) => <section key={key} className="rounded-2xl border border-slate-200 bg-panel/40 p-5"><p className="text-xs uppercase tracking-wider text-secondary">{t(`ads.${key}_label`)}</p><div className="my-6 flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 font-mono text-xs text-secondary">{key === "footer" ? "Responsive native" : "Responsive banner"}</div><p className="text-sm leading-relaxed text-secondary">{t(`ads.${key}_description`)}</p></section>)}</div>
    <section className="mt-10 rounded-2xl bg-panel/60 p-6"><h2 className="font-serif text-2xl">{t("ads.contact_title")}</h2><p className="mt-3 text-sm text-secondary">{t("ads.contact_description")}</p><a href={`mailto:${config.contactEmail}?subject=ReleaseLog%20sponsorship`} className="mt-5 inline-block rounded-full bg-accent px-5 py-3 text-sm font-medium text-white">{config.contactEmail} ↗</a></section>
    <p className="mt-8 text-xs leading-relaxed text-secondary">{t("ads.editorial")}</p></main>;
}

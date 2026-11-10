"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLocale, useT } from "./I18nProvider";

export function SiteHeader() {
  const pathname = usePathname(); const locale = useLocale(); const t = useT(); const [open, setOpen] = useState(false); const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname, locale]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && open) { setOpen(false); menuRef.current?.focus(); } }; document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, [open]);
  const links = [
    { href: "/", label: t("site.calendar"), active: pathname === "/" || (!/^\/(reset-log|sources|pricing|advertise|login|subscribe|privacy|admin)(\/|$)/.test(pathname)) },
    { href: "/reset-log", label: t("switcher.reset_log"), active: pathname.startsWith("/reset-log") },
    { href: "/sources", label: t("reset_log.sources"), active: pathname === "/sources" },
    { href: "/pricing", label: t("nav.pricing"), active: pathname === "/pricing" },
  ];
  return <><a className="skip-link" href="#main-content">{t("site.skip")}</a>
    <header data-export-exclude className="relative z-30 border-b border-slate-200 bg-white" data-site-header>
      <div className="mx-auto flex h-16 max-w-[1344px] items-center gap-3 px-6 md:gap-8 sm:px-10 lg:px-12">
        <Link href="/" className="shrink-0 font-serif text-[30px] tracking-tight text-primary">ReleaseLog</Link>
        <nav aria-label={t("site.navigation")} className="hidden h-full items-center gap-7 md:flex">{links.map(link => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} className={`flex h-full items-center border-b-2 pt-0.5 text-sm font-medium ${link.active ? "border-accent text-accent" : "border-transparent text-secondary hover:text-primary"}`}>{link.label}</Link>)}</nav>
        <div className="ml-auto flex items-center gap-3 sm:gap-5"><div className="hidden sm:block"><LanguageSwitcher /></div><Link href="/subscribe" className="rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white hover:brightness-95 sm:px-5">{t("nav.subscribe")}</Link>
          <button ref={menuRef} type="button" aria-expanded={open} aria-controls="mobile-site-nav" aria-label={t("site.menu")} onClick={() => setOpen(v => !v)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-primary md:hidden"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d={open ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
        </div>
      </div>
      {<nav id="mobile-site-nav" aria-label={t("site.navigation")} className={`${open ? "grid" : "hidden"} gap-1 border-t border-slate-200 px-6 py-3 md:hidden`}>{links.map(link => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-3 text-sm ${link.active ? "bg-orange-50 font-semibold text-accent" : "text-secondary"}`}>{link.label}</Link>)}<div className="px-3 py-2 sm:hidden"><LanguageSwitcher /></div></nav>}
    </header></>;
}
export function SiteFooter() {
  const t = useT();
  return <footer data-site-footer data-export-exclude className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-[1344px] flex-wrap items-center justify-between gap-5 px-6 py-8 sm:px-10 lg:px-12"><Link href="/" className="font-serif text-2xl text-primary">ReleaseLog</Link><nav aria-label={t("site.footer")} className="flex flex-wrap gap-6 text-sm text-secondary"><Link href="/sources" className="hover:text-primary">{t("reset_log.sources")}</Link><Link href="/advertise" className="hover:text-primary">{t("site.advertise")}</Link><Link href="/privacy" className="hover:text-primary">{t("nav.privacy")}</Link><Link href="/feeds/atom.xml" className="hover:text-primary">Atom / RSS</Link><Link href="/pricing" className="hover:text-primary">{t("nav.pricing")}</Link></nav></div></footer>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  AGENT_LABELS,
  AGENT_VENDORS,
  RESET_AGENT_SLUGS,
  RESET_EVENTS,
  RESET_EVENT_TYPE_LABELS,
  getRelatedResetEvents,
  getResetEventBySlug,
  isResetAgent,
  type ResetAgent,
} from "@/data/reset-log";
import { getSiteUrl } from "@/lib/site-url";
import { getServerTranslator } from "@/lib/i18n";
import { ResetLogList } from "../ResetLogList";

const AGENT_ACCENT: Record<ResetAgent, string> = {
  "claude-code": "#cc785c",
  codex: "#10a37f",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Pre-render one static HTML page per reset event at build time.
 * Adding a new event to RESET_EVENTS automatically produces a new page —
 * no per-event code required.
 */
export function generateStaticParams() {
  return [
    ...RESET_AGENT_SLUGS.map((slug) => ({ slug })),
    ...RESET_EVENTS.map((e) => ({ slug: e.slug })),
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (isResetAgent(slug)) {
    const agentLabel = AGENT_LABELS[slug];
    return {
      title: `${agentLabel} Reset Log`,
      description: `A dated log of public ${agentLabel} rate-limit, quota, and usage-window changes with official source links.`,
      alternates: { canonical: `/reset-log/${slug}` },
      openGraph: {
        type: "article",
        title: `${agentLabel} Reset Log`,
        description: `Public ${agentLabel} reset and quota-change events, curated from official records.`,
        url: `/reset-log/${slug}`,
      },
      twitter: {
        card: "summary",
        title: `${agentLabel} Reset Log`,
        description: `Public ${agentLabel} reset and quota-change events, curated from official records.`,
      },
    };
  }

  const event = getResetEventBySlug(slug);
  if (!event) return {};

  const agentLabel = AGENT_LABELS[event.agent];
  const vendor = AGENT_VENDORS[event.agent];
  const dateStr = format(parseISO(event.date), "MMMM d, yyyy");
  const title = `${event.title} — ${agentLabel} (${dateStr})`;
  const description = `${event.summary} Plans affected: ${event.plans.join(", ")}. Official record from ${vendor}.`;
  const canonical = `/reset-log/${event.slug}`;

  return {
    title: event.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      publishedTime: event.date,
      tags: [agentLabel, vendor, "rate limits", "quota reset", ...event.plans],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

function formatDate(iso: string): string {
  return format(parseISO(iso), "MMMM d, yyyy");
}

export default async function ResetEventPage({ params }: PageProps) {
  const { slug } = await params;
  if (isResetAgent(slug)) return <ResetLogList filter={slug} />;

  const event = getResetEventBySlug(slug);
  if (!event) notFound();

  const { t } = await getServerTranslator();

  const agentLabel = AGENT_LABELS[event.agent];
  const vendor = AGENT_VENDORS[event.agent];
  const accent = AGENT_ACCENT[event.agent];
  const typeLabel = RESET_EVENT_TYPE_LABELS[event.type];
  const related = getRelatedResetEvents(event, 3);
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/reset-log/${event.slug}`;

  // Schema.org Article — helps both classic SEO and answer-engine (GEO) parsers.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: event.title,
    datePublished: event.date,
    dateModified: event.effectiveDate ?? event.date,
    description: event.summary,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    author: { "@type": "Organization", name: vendor },
    publisher: {
      "@type": "Organization",
      name: "ReleaseLog",
      url: siteUrl,
    },
    isBasedOn: [event.source.url, ...(event.secondarySources?.map((s) => s.url) ?? [])],
    about: {
      "@type": "SoftwareApplication",
      name: agentLabel,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      offers: event.plans.map((plan) => ({
        "@type": "Offer",
        category: "subscription",
        name: `${agentLabel} ${plan}`,
      })),
    },
    keywords: [
      agentLabel,
      vendor,
      typeLabel,
      "rate limits",
      "quota reset",
      "subscription",
      ...event.plans,
    ].join(", "),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ReleaseLog", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Reset Log", item: `${siteUrl}/reset-log` },
      {
        "@type": "ListItem",
        position: 3,
        name: agentLabel,
        item: `${siteUrl}/reset-log/${event.agent}`,
      },
      { "@type": "ListItem", position: 4, name: event.title, item: canonicalUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-page text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-2 text-xs text-secondary"
        >
          <Link href="/" className="hover:text-primary">
            {t("brand.name")}
          </Link>
          <span aria-hidden>/</span>
          <Link href="/reset-log" className="hover:text-primary">
            {t("reset_log.kicker")}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/reset-log/${event.agent}`}
            className="hover:text-primary"
          >
            {agentLabel}
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate text-primary/80">{event.title}</span>
        </nav>

        <article>
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <time
                dateTime={event.date}
                className="font-mono font-semibold text-primary"
              >
                {formatDate(event.date)}
              </time>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-white/10"
                style={{ color: accent }}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                {agentLabel}
                <span className="text-secondary/70">· {vendor}</span>
              </span>
              <span className="rounded-full bg-empty-cell/60 px-2 py-0.5 text-[11px] font-medium text-secondary ring-1 ring-white/5">
                {typeLabel}
              </span>
              {event.effectiveDate && event.effectiveDate !== event.date && (
                <span className="rounded-full bg-empty-cell/40 px-2 py-0.5 text-[11px] text-secondary ring-1 ring-white/5">
                  {t("reset_log.effective", { date: formatDate(event.effectiveDate) })}
                </span>
              )}
            </div>

            <h1 className="font-serif text-3xl text-primary sm:text-4xl md:text-5xl">
              {event.title}
            </h1>

            <p className="text-base text-secondary sm:text-lg">{event.summary}</p>
          </header>

          <section className="mt-8 rounded-2xl bg-panel/60 p-5 ring-1 ring-white/5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
              {t("reset_log.at_a_glance")}
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-secondary/70">
                  {t("reset_log.field_agent")}
                </dt>
                <dd className="mt-1 text-primary">
                  {agentLabel} <span className="text-secondary">· {vendor}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-secondary/70">
                  {t("reset_log.field_event_type")}
                </dt>
                <dd className="mt-1 text-primary">{typeLabel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-secondary/70">
                  {t("reset_log.field_announced")}
                </dt>
                <dd className="mt-1 text-primary">{formatDate(event.date)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-secondary/70">
                  {t("reset_log.field_effective")}
                </dt>
                <dd className="mt-1 text-primary">
                  {formatDate(event.effectiveDate ?? event.date)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-secondary/70">
                  {t("reset_log.field_plans")}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {event.plans.map((plan) => (
                    <span
                      key={plan}
                      className="rounded-full bg-empty-cell/60 px-2 py-0.5 text-[11px] font-medium text-secondary ring-1 ring-white/5"
                    >
                      {plan}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          {event.details && event.details.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
                {t("reset_log.what_changed")}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-secondary sm:text-base">
                {event.details.map((d, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-1 text-accent/70">
                      ·
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8 rounded-2xl bg-accent/5 p-5 ring-1 ring-accent/30 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              {t("reset_log.official_record_section")}
            </h2>
            <p className="mt-2 text-sm text-secondary">
              {t("reset_log.official_record_lead", { vendor })}
            </p>
            <a
              href={event.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-[var(--bg-page)] hover:opacity-90"
            >
              {event.source.label}
              <span aria-hidden>↗</span>
            </a>
            {event.secondarySources && event.secondarySources.length > 0 && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-wider text-secondary/70">
                  {t("reset_log.additional_references")}
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {event.secondarySources.map((src) => (
                    <li key={src.url}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary underline-offset-4 hover:text-primary hover:underline"
                      >
                        {src.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {related.length > 0 && (
            <section className="mt-12 border-t border-white/5 pt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
                {t("reset_log.more_events", { agent: agentLabel })}
              </h2>
              <ul className="mt-4 space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/reset-log/${r.slug}`}
                      className="group flex flex-col gap-1 rounded-xl bg-panel/40 p-4 ring-1 ring-white/5 transition-colors hover:bg-panel"
                    >
                      <div className="flex items-center gap-2 text-xs text-secondary">
                        <time dateTime={r.date} className="font-mono">
                          {formatDate(r.date)}
                        </time>
                        <span aria-hidden>·</span>
                        <span>{RESET_EVENT_TYPE_LABELS[r.type]}</span>
                      </div>
                      <p className="font-serif text-base text-primary group-hover:text-accent sm:text-lg">
                        {r.title}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-secondary/80">
          <Link
            href="/reset-log"
            className="font-semibold uppercase tracking-[0.25em] hover:text-primary"
          >
            {t("reset_log.all_events_back")}
          </Link>
          <p>
            {t("reset_log.found_issue")}{" "}
            <a
              href="mailto:haoruileee@gmail.com"
              className="text-accent underline-offset-4 hover:underline"
            >
              haoruileee@gmail.com
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

// Dynamically rendered: the root layout reads the locale cookie, which opts
// the whole tree out of static generation. `generateStaticParams` is still
// used to pre-warm prerender hints for crawlers.
export const dynamicParams = false;

import { CacheAccountingExample } from "@/components/CacheAccountingExample";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { guides, getGuide, editorialSources, readingMinutes } from "@/lib/editorial";
import { getSiteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return guides.map(guide => ({ slug: guide.slug })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return { title: "Guide not found" };
  return { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` }, openGraph: { type: "article", title: guide.title, description: guide.description, publishedTime: guide.publishedAt, modifiedTime: guide.reviewedAt } };
}
const labels = { documented: "Documented behaviour", analysis: "Editorial analysis", example: "Hypothetical example", checklist: "Verification checklist" };
function inline(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => part.startsWith("`") && part.endsWith("`") ? <code key={i} className="break-words rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-primary">{part.slice(1, -1)}</code> : part);
}
export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const sources = editorialSources.filter(source => guide.sourceIds.includes(source.id));
  const related = guides.filter(item => item.slug !== guide.slug);
  const structured = { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, inLanguage: "en", datePublished: guide.publishedAt, dateModified: guide.reviewedAt, author: { "@type": "Organization", name: "ReleaseLog", url: getSiteUrl() }, publisher: { "@type": "Organization", name: "ReleaseLog" }, mainEntityOfPage: `${getSiteUrl()}/guides/${guide.slug}`, citation: sources.map(source => source.url) };
  return <main className="mx-auto max-w-[1040px] px-6 py-12 sm:px-10">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    <article lang="en" data-editorial-guide>
      <Link href="/guides" className="text-sm text-accent hover:underline">← Guides & analysis</Link>
      <header className="mt-8 border-b border-slate-200 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Practical guide · {readingMinutes(guide)} min read</p>
        <h1 className="editorial-title mt-4 max-w-4xl text-4xl leading-tight sm:text-5xl">{guide.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-secondary">{guide.description}</p>
        <p className="mt-5 text-xs leading-relaxed text-secondary">ReleaseLog editorial · Published <time dateTime={guide.publishedAt}>{guide.publishedAt}</time> · Sources checked <time dateTime={guide.reviewedAt}>{guide.reviewedAt}</time></p>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-secondary">AI-assisted draft and independent AI source review. <Link href="/guides#editorial-method" className="text-accent underline">Editorial method & corrections</Link>. Examples are hypothetical; this is not a benchmark or a new-release announcement.</p>
      </header>
      <nav aria-label="On this page" className="mt-8 rounded-xl border border-slate-200 bg-panel p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">On this page</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">{guide.sections.map((section, index) => <li key={index}><a href={`#section-${index + 1}`} className="text-sm text-accent hover:underline">{index + 1}. {section.heading}</a></li>)}</ol>
      </nav>
      <div className="mt-10 max-w-3xl space-y-10">{guide.sections.map((section, index) => <section key={index} id={`section-${index + 1}`} className="scroll-mt-8" data-section-kind={section.kind}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">{labels[section.kind]}</p>
        <h2 className="mt-2 font-serif text-3xl leading-tight">{section.heading}</h2>
        <div className="mt-4 space-y-4 text-base leading-8 text-secondary">{section.paragraphs.map((paragraph, i) => <p key={i}>{inline(paragraph)}</p>)}
          {section.items && section.items.length > 0 && <ul className="list-disc space-y-3 pl-5">{section.items.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>}
        </div>
        {section.sourceIds.length > 0 && <p className="mt-4 text-xs text-secondary">Reference: {section.sourceIds.map((id, i) => <span key={id}>{i > 0 ? " · " : ""}<a href={`#source-${id}`} className="text-accent underline">{editorialSources.find(source => source.id === id)?.title}</a></span>)}</p>}
      </section>)}</div>
      {guide.slug === "claude-prompt-cache-boundaries" && <CacheAccountingExample />}
      <section className="mt-12 border-t border-slate-200 pt-8" aria-labelledby="sources-title">
        <h2 id="sources-title" className="font-serif text-3xl">Primary sources</h2>
        <p className="mt-3 text-sm leading-relaxed text-secondary">Documentation can change. Check the linked page and your installed version before applying a recommendation. Source-check dates describe this guide&apos;s review, not the feature&apos;s release date.</p>
        <ol className="mt-5 space-y-4">{sources.map(source => <li key={source.id} id={`source-${source.id}`} className="scroll-mt-8 rounded-lg border border-slate-200 p-4"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:underline">{source.title} ↗</a><p className="mt-2 break-all text-xs text-secondary">{new URL(source.url).hostname} · Checked <time dateTime={source.checked}>{source.checked}</time></p></li>)}</ol>
      </section>
      <section className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-6" aria-label="Related release calendars">{guide.entityIds.map(id => <Link key={id} href={`/${id}`} className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-accent hover:bg-panel">{id.replace(/-/g, " ")} release calendar ↗</Link>)}</section>
    </article>
    <section className="mt-12 border-t border-slate-200 pt-8"><h2 className="font-serif text-2xl">More guides</h2><ul className="mt-4 space-y-3">{related.map(item => <li key={item.slug}><Link href={`/guides/${item.slug}`} className="text-sm text-accent hover:underline">{item.title} →</Link></li>)}</ul></section>
  </main>;
}

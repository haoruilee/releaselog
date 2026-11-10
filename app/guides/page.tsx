import type { Metadata } from "next";
import Link from "next/link";
import { guides, readingMinutes } from "@/lib/editorial";
import { getLocale } from "@/lib/i18n";
export const metadata: Metadata = {
  title: "Guides & analysis", description: "Source-backed explanations of AI developer tools: practical decisions, failure scenarios, limitations and verification checklists.", alternates: { canonical: "/guides" },
};
export default async function GuidesPage() {
  const zh = (await getLocale()) === "zh";
  return <main className="mx-auto max-w-[1040px] px-6 py-12 sm:px-10" data-guides-index>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{zh ? "ReleaseLog 编辑解读" : "ReleaseLog editorial"}</p>
    <h1 className="editorial-title mt-4 text-4xl sm:text-5xl">{zh ? "理解变化，做出下一步决定。" : "From a release note to a practical decision."}</h1>
    <p className="mt-6 max-w-3xl text-base leading-relaxed text-secondary">{zh ? "官方资料告诉我们功能是什么；这些英文指南进一步解释适用场景、实施取舍和核验方法。明确区分文档事实、编辑分析与假设案例。" : "Official documentation explains the capability. These English-language guides examine when it fits, what can go wrong, and how to check your next step. Documented facts, editorial analysis and hypothetical examples are labeled separately."}</p>
    <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">{guides.map(guide => <article key={guide.slug} lang="en" className="py-8" data-guide-card>
      <p className="text-xs text-secondary">{guide.entityIds.map(id => id.replace(/-/g, " ")).join(" · ")} · {readingMinutes(guide)} min read</p>
      <h2 className="mt-3 font-serif text-3xl leading-tight"><Link href={`/guides/${guide.slug}`} className="text-primary hover:text-accent">{guide.title}</Link></h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary">{guide.description}</p>
      <p className="mt-4 text-xs text-secondary">Published <time dateTime={guide.publishedAt}>{guide.publishedAt}</time> · Sources checked <time dateTime={guide.reviewedAt}>{guide.reviewedAt}</time></p>
    </article>)}</div>
    <section id="editorial-method" className="mt-12 rounded-xl border border-slate-200 bg-panel p-6">
      <h2 className="font-serif text-2xl">{zh ? "这些指南如何编写" : "How these guides are made"}</h2>
      <p className="mt-4 text-sm leading-relaxed text-secondary">{zh ? "由 GLM 辅助整理和起草，再由另一 AI 审阅流程对照链接的官方文档核验及修订。没有声称经过人工专家审查。案例为假设场景，不是实测；不编造测试结果或作者资历。核验日期表示资料检查日期，不代表新版本发布日期。" : "GLM assists with organization and drafting. A separate AI review pass checks and revises claims against the linked primary documentation; these articles have not been reviewed by a human expert. Examples are hypothetical, not measured deployments. We do not invent benchmark results or author credentials. A source-check date is not a product release date."}</p>
      <p className="mt-4 text-sm text-secondary">{zh ? "发现错误？请附上文章链接和官方来源联系：" : "Found an error? Send the guide URL and primary-source correction to "}<a href="mailto:haoruileee@gmail.com" className="break-all text-accent underline">haoruileee@gmail.com</a>.</p>
    </section>
  </main>;
}

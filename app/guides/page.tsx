import type { Metadata } from "next";
import Link from "next/link";
import { guides, readingMinutes } from "@/lib/editorial";
import { getLocale } from "@/lib/i18n";
export const metadata: Metadata = {
  title: "Guides & analysis", description: "Original project field notes and source-backed developer guides, with recorded checks, practical tradeoffs and explicit limitations.", alternates: { canonical: "/guides" },
};
export default async function GuidesPage() {
  const zh = (await getLocale()) === "zh";
  return <main className="mx-auto max-w-[1040px] px-6 py-12 sm:px-10" data-guides-index>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{zh ? "ReleaseLog 编辑解读" : "ReleaseLog editorial"}</p>
    <h1 className="editorial-title mt-4 text-4xl sm:text-5xl">{zh ? "理解变化，做出下一步决定。" : "From a release note to a practical decision."}</h1>
    <p className="mt-6 max-w-3xl text-base leading-relaxed text-secondary">{zh ? "官方资料告诉我们功能是什么；这些英文指南与项目实践记录进一步解释适用场景、实施取舍和核验方法。明确区分文档事实、项目观察、编辑分析与假设案例。" : "Official documentation explains the capability. These English-language guides and project field notes examine when it fits, what can go wrong, and how to check your next step. Documented facts, project observations, editorial analysis and hypothetical examples are labeled separately."}</p>
    <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">{guides.map(guide => <article key={guide.slug} lang="en" className="py-8" data-guide-card>
      <p className="text-xs text-secondary">{guide.genre === "field-note" ? "Our project · Field note" : guide.entityIds.map(id => id.replace(/-/g, " ")).join(" · ")} · {readingMinutes(guide)} min read</p>
      <h2 className="mt-3 font-serif text-3xl leading-tight"><Link href={`/guides/${guide.slug}`} className="text-primary hover:text-accent">{guide.title}</Link></h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary">{guide.description}</p>
      <p className="mt-4 text-xs text-secondary">Published <time dateTime={guide.publishedAt}>{guide.publishedAt}</time> · Sources checked <time dateTime={guide.reviewedAt}>{guide.reviewedAt}</time></p>
    </article>)}</div>
    <section id="editorial-method" className="mt-12 rounded-xl border border-slate-200 bg-panel p-6">
      <h2 className="font-serif text-2xl">{zh ? "这些指南如何编写" : "How these guides are made"}</h2>
      <p className="mt-4 text-sm leading-relaxed text-secondary">{zh ? "由 GLM 辅助整理和起草，再由另一 AI 审阅流程对照链接的官方文档、项目代码和检查记录核验及修订。没有声称经过人工专家审查。指南中的假设案例会单独标注；实践记录只报告已记录的项目观察及受控检查，不将其当作生产性能测试。核验日期表示资料检查日期，不代表新版本发布日期。" : "GLM assists with organization and drafting. A separate AI review pass checks and revises claims against the linked primary documentation, project code and controlled-check records; these articles have not been reviewed by a human expert. Guide examples are hypothetical. Field notes identify actual project observations and controlled reproductions with their scope limits. We do not invent benchmark results or author credentials. A source-check date is not a product release date."}</p>
      <p className="mt-4 text-sm text-secondary">{zh ? "发现错误？请附上文章链接和官方来源联系：" : "Found an error? Send the guide URL and primary-source correction to "}<a href="mailto:haoruileee@gmail.com" className="break-all text-accent underline">haoruileee@gmail.com</a>.</p>
    </section>
  </main>;
}

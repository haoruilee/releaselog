import content from "@/data/editorial-guides.json";
export type EditorialSource = { id: string; title: string; url: string; checked: string };
export type GuideSection = { heading: string; kind: "documented" | "analysis" | "example" | "checklist"; paragraphs: string[]; items?: string[]; sourceIds: string[] };
export type EditorialGuide = { slug: string; title: string; description: string; entityIds: string[]; sourceIds: string[]; publishedAt: string; reviewedAt: string; sections: GuideSection[] };
export const guides = content.articles as EditorialGuide[];
export const editorialSources = content.sources as EditorialSource[];
export const getGuide = (slug: string) => guides.find(guide => guide.slug === slug);
export function readingMinutes(guide: EditorialGuide) {
  const words = guide.sections.flatMap(section => [...section.paragraphs, ...(section.items || [])]).join(" ").trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

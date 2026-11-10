import checks from "@/public/research/editorial-field-checks-20261110.json";
import content from "@/data/editorial-guides.json";
export type EditorialSource = { id: string; title: string; url: string; checked: string; kind?: "project-record" | "experiment" };
export type GuideSection = { heading: string; kind: "documented" | "analysis" | "example" | "checklist" | "observed"; paragraphs: string[]; items?: string[]; sourceIds: string[] };
export type EditorialGuide = { slug: string; title: string; description: string; entityIds: string[]; sourceIds: string[]; publishedAt: string; reviewedAt: string; sections: GuideSection[]; genre?: "guide" | "field-note"; evidenceKeys?: string[]; evidenceScope?: string };
export const guides = content.articles as EditorialGuide[];
export const editorialSources = content.sources as EditorialSource[];
export const getGuide = (slug: string) => guides.find(guide => guide.slug === slug);
export function readingMinutes(guide: EditorialGuide) {
  const words = guide.sections.flatMap(section => [...section.paragraphs, ...(section.items || [])]).join(" ").trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export const projectChecks = checks;
export function evidenceRows(key: string): [string, string][] {
  const g = checks.groups;
  if (key === "reviewBoundary") return [["Controlled normalizer cases", String(g.reviewBoundary.cases)], ["Supplied score 0.85", g.reviewBoundary.atThreshold], ["Supplied score 0.84", g.reviewBoundary.belowThreshold], ["Missing, unknown or duplicate decisions", g.reviewBoundary.missingUnknownAndDuplicateDecisions]];
  if (key === "datesAndIdentity") return [["Controlled parser cases", String(g.datesAndIdentity.cases)], ["Tracking-query variants", g.datesAndIdentity.queryVariants], ["Future date / forecast", `${g.datesAndIdentity.futureDate} / ${g.datesAndIdentity.forecast}`], ["Merged output records", String(g.datesAndIdentity.mergedRecords)], ["Retained event date", g.datesAndIdentity.retainedEventDate]];
  if (key === "domCounting") return [["Controlled fixture: raw markers / article nodes", `${g.domCounting.fixture.rawMarkerOccurrences} / ${g.domCounting.fixture.renderedArticleNodes}`], ["Pre-batch public snapshot: raw markers / article nodes", `${g.domCounting.publicSnapshot.rawMarkerOccurrences} / ${g.domCounting.publicSnapshot.renderedArticleNodes}`], ["Public snapshot collected", g.domCounting.publicSnapshot.collectedAt]];
  if (key === "staticAssets") return [["Controlled merge cases", String(g.staticAssets.cases)], ["Old files / merged files", `${g.staticAssets.oldFiles} / ${g.staticAssets.mergedFiles}`], ["Old content hash preserved", g.staticAssets.oldContentHashPreserved ? "yes" : "no"], ["Different bytes at the same path", g.staticAssets.changedBytesAtSamePath]];
  return [];
}

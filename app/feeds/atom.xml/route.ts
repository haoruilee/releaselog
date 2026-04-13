import { entities } from "@/data";
import { buildAtomFeed, collectAllFeedEntries } from "@/lib/atom-feed";

export const dynamic = "force-static";

export function GET() {
  const entries = collectAllFeedEntries(entities, 200);
  const xml = buildAtomFeed({
    title: "ReleaseLog — all teams",
    subtitle: "Recent releases across every tracked feed.",
    feedPath: "/feeds/atom.xml",
    entries,
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

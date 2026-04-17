import { unstable_noStore as noStore } from "next/cache";
import { buildAtomFeed, collectAllFeedEntries } from "@/lib/atom-feed";
import { getMergedEntities } from "@/lib/releases-store";

export async function GET() {
  if (process.env.STATIC_EXPORT !== "1" && process.env.NEXT_PUBLIC_USE_SERVER_DATA !== "0") {
    noStore();
  }
  const entities = await getMergedEntities();
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

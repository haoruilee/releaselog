import { unstable_noStore as noStore } from "next/cache";
import { entities } from "@/data";
import type { ReleaseItem } from "@/data/types";
import { buildAtomFeed, type FeedEntry } from "@/lib/atom-feed";
import { getMergedEntityById } from "@/lib/releases-store";

export function generateStaticParams() {
  return entities.map((e) => ({ entityId: e.id }));
}

type Params = { params: Promise<{ entityId: string }> };

export async function GET(_request: Request, context: Params) {
  if (process.env.STATIC_EXPORT !== "1" && process.env.NEXT_PUBLIC_USE_SERVER_DATA !== "0") {
    noStore();
  }
  const { entityId } = await context.params;
  const entity = await getMergedEntityById(entityId);
  if (!entity) {
    return new Response("Not found", { status: 404 });
  }

  const sorted = [...entity.releases].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.importance ?? 1) - (a.importance ?? 1);
  });
  const slice = sorted.slice(0, 100);

  const entries: FeedEntry[] = slice.map((item: ReleaseItem) => ({
    entityId: entity.id,
    entityName: entity.name,
    item,
  }));

  const xml = buildAtomFeed({
    title: `ReleaseLog — ${entity.name}`,
    subtitle: entity.description,
    feedPath: `/feeds/${entity.id}/atom.xml`,
    entries,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

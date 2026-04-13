import { getEntityById, entities } from "@/data";
import type { ReleaseItem } from "@/data/types";
import { buildAtomFeed, type FeedEntry } from "@/lib/atom-feed";

export const dynamic = "force-static";

export function generateStaticParams() {
  return entities.map((e) => ({ entityId: e.id }));
}

type Params = { params: Promise<{ entityId: string }> };

export async function GET(_request: Request, context: Params) {
  const { entityId } = await context.params;
  const entity = getEntityById(entityId);
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

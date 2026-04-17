import { buildAtomFeed, collectAllFeedEntries } from "@/lib/atom-feed";
import { resolvePrivateFeedAccess } from "@/lib/account-store";
import { getMergedEntities } from "@/lib/releases-store";
import { isSubscriptionActive } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, context: Params) {
  const params = await context.params;
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) {
    return new Response("Not found", { status: 404 });
  }
  const access = await resolvePrivateFeedAccess(token);
  if (!access) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!access.preferences?.rssEnabled) {
    return new Response("RSS disabled", { status: 403 });
  }
  if (!isSubscriptionActive(access.subscription?.status)) {
    return new Response("Subscription inactive", { status: 403 });
  }

  const entities = await getMergedEntities();
  const selected = new Set(access.preferences.selectedEntityIds);
  const filteredEntities = entities.filter((entity) => selected.has(entity.id));
  const entries = collectAllFeedEntries(filteredEntities, 200);
  const xml = buildAtomFeed({
    title: "ReleaseLog Pro — private feed",
    subtitle: `Filtered releases for ${access.user.email}`,
    feedPath: `/feeds/private/${token}.xml`,
    entries,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

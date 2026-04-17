import { entityMetas } from "@/data";
import { getCurrentUser } from "@/lib/auth";
import { getActivePrivateFeedToken } from "@/lib/account-store";
import { getSiteUrl } from "@/lib/site-url";
import { isSubscriptionActive } from "@/lib/runtime-config";
import { buildPrivateFeedToken } from "@/lib/security";
import { SubscribeClient } from "@/components/SubscribeClient";

export default async function SubscribePage() {
  const current = await getCurrentUser();
  const activeToken = current ? await getActivePrivateFeedToken(current.user.id) : null;
  const privateFeedUrl =
    current && activeToken
      ? `${getSiteUrl()}/feeds/private/${buildPrivateFeedToken(activeToken.id)}.xml`
      : null;
  const isPro = isSubscriptionActive(current?.subscription?.status);

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">ReleaseLog</p>
        <h1 className="mt-2 font-serif text-3xl text-primary sm:text-4xl">Subscribe</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
          Public release logs stay open. Pro unlocks realtime email alerts and a private RSS feed
          scoped to the teams you actually track.
        </p>

        <div className="mt-10">
          <SubscribeClient
            entities={entityMetas.map((entity) => ({ id: entity.id, name: entity.name }))}
            email={current?.user.email ?? null}
            isLoggedIn={Boolean(current)}
            isPro={isPro}
          subscriptionStatus={current?.subscription?.status ?? null}
          emailEnabled={current?.preferences?.emailEnabled ?? true}
          rssEnabled={current?.preferences?.rssEnabled ?? true}
          selectedEntityIds={current?.preferences?.selectedEntityIds ?? entityMetas.map((entity) => entity.id)}
          privateFeedUrl={isPro ? privateFeedUrl : null}
          checkoutEnabled={Boolean(process.env.STRIPE_SECRET_KEY)}
          portalEnabled={Boolean(process.env.STRIPE_SECRET_KEY)}
        />
      </div>
      </div>
    </div>
  );
}

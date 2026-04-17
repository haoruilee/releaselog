import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listActiveSubscribers } from "@/lib/account-store";
import { isAdminEmail, isSubscriptionActive } from "@/lib/runtime-config";

export default async function AdminSubscribersPage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login?next=/admin/subscribers");
  }
  if (!isAdminEmail(current.user.email)) {
    redirect("/subscribe");
  }

  const subscribers = await listActiveSubscribers();

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-3xl">Subscribers</h1>
        <div className="mt-6 grid gap-4">
          {subscribers.map(({ user, subscription, preferences }) => (
            <section key={user.id} className="rounded-2xl bg-panel/50 p-5 ring-1 ring-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{user.email}</h2>
                  <p className="text-sm text-secondary">
                    {subscription.status} {isSubscriptionActive(subscription.status) ? "· active access" : "· inactive"}
                  </p>
                </div>
                <div className="text-sm text-secondary">
                  Email: {preferences.emailEnabled ? "on" : "off"} · RSS: {preferences.rssEnabled ? "on" : "off"}
                </div>
              </div>
              <p className="mt-3 text-sm text-secondary">
                Entities: {preferences.selectedEntityIds.join(", ") || "None"}
              </p>
            </section>
          ))}
          {subscribers.length === 0 && (
            <div className="rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5 text-sm text-secondary">
              No subscribers yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

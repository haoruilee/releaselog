"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type EntityOption = {
  id: string;
  name: string;
};

type Props = {
  entities: EntityOption[];
  email: string | null;
  isLoggedIn: boolean;
  isPro: boolean;
  subscriptionStatus: string | null;
  emailEnabled: boolean;
  rssEnabled: boolean;
  selectedEntityIds: string[];
  privateFeedUrl: string | null;
  checkoutEnabled: boolean;
  portalEnabled: boolean;
};

export function SubscribeClient(props: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.selectedEntityIds));
  const [emailEnabled, setEmailEnabled] = useState(props.emailEnabled);
  const [rssEnabled, setRssEnabled] = useState(props.rssEnabled);
  const [message, setMessage] = useState("");
  const [privateFeedUrl, setPrivateFeedUrl] = useState(props.privateFeedUrl);
  const [saving, setSaving] = useState(false);
  const publicFeedList = useMemo(
    () => [
      { label: "All teams", href: "/feeds/atom.xml" },
      ...props.entities.map((entity) => ({
        label: entity.name,
        href: `/feeds/${entity.id}/atom.xml`,
      })),
    ],
    [props.entities],
  );

  function toggleEntity(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function savePreferences() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityIds: [...selected],
          emailEnabled,
          rssEnabled,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Could not save preferences.");
        return;
      }
      setMessage("Preferences saved.");
    } catch {
      setMessage("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout(plan: "monthly" | "yearly") {
    setMessage("");
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setMessage(payload.error ?? "Checkout is not configured.");
      return;
    }
    window.location.href = payload.url;
  }

  async function openPortal() {
    setMessage("");
    const response = await fetch("/api/billing/portal", {
      method: "POST",
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setMessage(payload.error ?? "Billing portal is not configured.");
      return;
    }
    window.location.href = payload.url;
  }

  async function rotateFeedToken() {
    setMessage("");
    const response = await fetch("/api/account/private-feed/rotate", {
      method: "POST",
    });
    const payload = (await response.json()) as { feedUrl?: string; error?: string };
    if (!response.ok || !payload.feedUrl) {
      setMessage(payload.error ?? "Could not rotate private feed.");
      return;
    }
    setPrivateFeedUrl(payload.feedUrl);
    setMessage("Private RSS URL rotated.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-primary">Public Atom feeds</h2>
        <ul className="space-y-2 text-sm text-secondary">
          {publicFeedList.map((feed) => (
            <li key={feed.href}>
              <a href={feed.href} className="text-accent underline-offset-4 hover:underline">
                {feed.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {!props.isLoggedIn && (
        <section className="rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
          <p className="text-sm text-secondary">
            Sign in to subscribe to realtime email and generate your private RSS URL.
          </p>
          <p className="mt-3">
            <Link href="/login?next=/subscribe" className="text-accent underline-offset-4 hover:underline">
              Go to sign in
            </Link>
          </p>
        </section>
      )}

      {props.isLoggedIn && (
        <>
          <section className="rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-primary">Account</h2>
                <p className="text-sm text-secondary">{props.email}</p>
                <p className="text-xs text-secondary/80">
                  Subscription status: {props.subscriptionStatus ?? "not_started"}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-primary"
              >
                Log out
              </button>
            </div>
          </section>

          {!props.isPro && (
            <section className="rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
              <h2 className="text-base font-semibold text-primary">Upgrade to Pro</h2>
              <p className="mt-2 text-sm text-secondary">
                Pro unlocks realtime email alerts and a private RSS feed that tracks only the teams
                you selected.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!props.checkoutEnabled}
                  onClick={() => startCheckout("monthly")}
                  className="rounded-full bg-active-cell px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Start monthly plan
                </button>
                <button
                  type="button"
                  disabled={!props.checkoutEnabled}
                  onClick={() => startCheckout("yearly")}
                  className="rounded-full border border-white/10 px-5 py-2 text-sm text-primary disabled:opacity-50"
                >
                  Start yearly plan
                </button>
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-primary">Notification preferences</h2>
                <p className="text-sm text-secondary">
                  Select the feeds that should power your Pro notifications.
                </p>
              </div>
              {props.isPro && props.portalEnabled && (
                <button
                  type="button"
                  onClick={openPortal}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-primary"
                >
                  Manage billing
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-2">
              {props.entities.map((entity) => (
                <label
                  key={entity.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg bg-empty-cell/40 px-3 py-2 ring-1 ring-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entity.id)}
                    onChange={() => toggleEntity(entity.id)}
                    className="mt-1"
                  />
                  <span className="text-sm text-primary">{entity.name}</span>
                </label>
              ))}
            </div>

            <div className="mt-5 space-y-3 text-sm text-primary">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(event) => setEmailEnabled(event.target.checked)}
                />
                <span>Realtime email notifications</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={rssEnabled}
                  onChange={(event) => setRssEnabled(event.target.checked)}
                />
                <span>Private RSS feed</span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={savePreferences}
                disabled={saving}
                className="rounded-full bg-active-cell px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save preferences"}
              </button>
              {props.isPro && (
                <button
                  type="button"
                  onClick={rotateFeedToken}
                  className="rounded-full border border-white/10 px-5 py-2 text-sm text-primary"
                >
                  Rotate private RSS URL
                </button>
              )}
            </div>

            {privateFeedUrl && (
              <div className="mt-5 rounded-xl bg-empty-cell/40 p-4 text-sm">
                <p className="text-secondary">Private RSS URL</p>
                <a href={privateFeedUrl} className="break-all text-accent underline-offset-4 hover:underline">
                  {privateFeedUrl}
                </a>
              </div>
            )}

            {message && <p className="mt-4 text-sm text-secondary">{message}</p>}
          </section>
        </>
      )}
    </div>
  );
}

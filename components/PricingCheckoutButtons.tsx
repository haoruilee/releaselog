"use client";

import Link from "next/link";
import { useState } from "react";

type Plan = "monthly" | "yearly";

type Props = {
  plan: Plan;
  label: string;
  enabled: boolean;
  isLoggedIn: boolean;
  isPro: boolean;
  primary?: boolean;
};

export function PricingCheckoutButtons({
  plan,
  label,
  enabled,
  isLoggedIn,
  isPro,
  primary,
}: Props) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseClasses = primary
    ? "inline-flex w-full items-center justify-center rounded-full bg-active-cell px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
    : "inline-flex w-full items-center justify-center rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-primary disabled:opacity-60";

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/pricing?plan=${plan}`)}`}
        className={baseClasses}
      >
        Sign in to subscribe
      </Link>
    );
  }

  if (isPro) {
    return (
      <Link href="/subscribe" className={baseClasses}>
        You are already Pro — Manage
      </Link>
    );
  }

  async function startCheckout() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Checkout is not available right now.");
        setWorking(false);
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError("Network error starting checkout.");
      setWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={!enabled || working}
        className={baseClasses}
      >
        {working ? "Redirecting…" : label}
      </button>
      {!enabled && (
        <p className="mt-2 text-xs text-secondary">
          Checkout is temporarily unavailable. Try again shortly.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

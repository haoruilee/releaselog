"use client";

import { useState } from "react";
import Link from "next/link";
import { entities } from "@/data";

export default function SubscribePage() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(entities.map((e) => e.id)));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          entityIds: [...selected],
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; hint?: string };
      if (!res.ok) {
        setStatus("err");
        setMessage(
          data.hint ??
            (data.error === "email_not_configured"
              ? "Email signup is not configured on this deployment (add Upstash Redis)."
              : data.error ?? "Something went wrong."),
        );
        return;
      }
      setStatus("ok");
      setMessage("You’re on the list. Weekly summaries use the feeds you selected.");
    } catch {
      setStatus("err");
      setMessage("Network error. Try again or use RSS below.");
    }
  }

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
          ReleaseLog
        </p>
        <h1 className="mt-2 font-serif text-3xl text-primary sm:text-4xl">Subscribe</h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          Follow updates via <strong className="text-primary/90">RSS/Atom</strong> (any reader —
          automatic refresh). Optionally add your email for a{" "}
          <strong className="text-primary/90">weekly digest</strong> when the site operator enables
          it.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-sm font-semibold text-primary">Atom feeds</h2>
          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <a
                href="/feeds/atom.xml"
                className="text-accent underline-offset-4 hover:underline"
              >
                All teams (combined)
              </a>
              <span className="text-secondary/70"> — paste into Feedly, Inoreader, NetNewsWire…</span>
            </li>
            {entities.map((e) => (
              <li key={e.id}>
                <a
                  href={`/feeds/${e.id}/atom.xml`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {e.name}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold text-primary">Email (optional)</h2>
          <p className="mt-2 text-xs text-secondary/90">
            Weekly Monday digest (~09:00 UTC if using Vercel Cron). Requires{" "}
            <code className="rounded bg-empty-cell/60 px-1 text-[11px] text-primary/90">
              RESEND_API_KEY
            </code>
            ,{" "}
            <code className="rounded bg-empty-cell/60 px-1 text-[11px] text-primary/90">
              DIGEST_FROM_EMAIL
            </code>
            , Upstash Redis, and{" "}
            <code className="rounded bg-empty-cell/60 px-1 text-[11px] text-primary/90">
              CRON_SECRET
            </code>
            .
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              {entities.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg bg-panel/40 px-3 py-2 ring-1 ring-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="mt-1"
                  />
                  <span className="text-sm text-primary">{e.name}</span>
                </label>
              ))}
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-empty-cell/30 px-3 py-2 text-sm text-primary placeholder:text-secondary/50"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading" || selected.size === 0}
              className="rounded-full bg-active-cell px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {status === "loading" ? "Saving…" : "Subscribe to weekly email"}
            </button>
            {message && (
              <p
                className={
                  status === "ok" ? "text-sm text-secondary" : "text-sm text-orange-300/90"
                }
              >
                {message}
              </p>
            )}
          </form>
        </section>

        <p className="mt-12 text-sm text-secondary">
          <Link href="/" className="text-accent underline-offset-4 hover:underline">
            ← Back to calendar
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

type Props = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    setPreviewUrl(null);

    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          next: nextPath,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        previewUrl?: string;
      };
      if (!response.ok) {
        setStatus("err");
        setMessage(payload.error ?? "Could not send sign-in link.");
        return;
      }
      setStatus("ok");
      setPreviewUrl(payload.previewUrl ?? null);
      setMessage(
        payload.previewUrl
          ? "Email delivery is not configured here yet. Use the preview link below."
          : "Magic link sent. Check your inbox.",
      );
    } catch {
      setStatus("err");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
      <div>
        <label htmlFor="login-email" className="sr-only">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-white/10 bg-empty-cell/30 px-4 py-3 text-sm text-primary placeholder:text-secondary/50"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-full bg-active-cell px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {message && (
        <div className="space-y-2 text-sm text-secondary">
          <p>{message}</p>
          {previewUrl && (
            <p>
              <a href={previewUrl} className="text-accent underline-offset-4 hover:underline">
                Open preview link
              </a>
            </p>
          )}
        </div>
      )}
    </form>
  );
}

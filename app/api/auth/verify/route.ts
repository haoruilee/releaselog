import { NextResponse } from "next/server";
import { signInWithMagicToken } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";

function safeNextPath(value: string | null | undefined): string {
  const nextPath = value?.trim();
  return nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/subscribe";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  const nextPath = searchParams.get("next")?.trim();

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", getSiteUrl()));
  }

  const safeDestination = safeNextPath(nextPath);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Confirm sign in · ReleaseLog</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0c0a09;
        color: #fef3e2;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(92vw, 420px);
        padding: 32px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 18px;
        background: rgba(22,18,16,.78);
      }
      p { color: #fdba74; line-height: 1.55; }
      button {
        width: 100%;
        margin-top: 16px;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: #c2410c;
        color: white;
        font-weight: 650;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Confirm sign in</h1>
      <p>Click the button below to finish signing in. This extra step prevents email scanners from consuming your one-time link.</p>
      <form method="post" action="/api/auth/verify">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <input type="hidden" name="next" value="${escapeHtml(safeDestination)}" />
        <button type="submit">Sign in to ReleaseLog</button>
      </form>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenValue = form.get("token");
  const nextValue = form.get("next");
  const token = typeof tokenValue === "string" ? tokenValue.trim() : "";
  const nextPath = typeof nextValue === "string" ? nextValue.trim() : null;

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", getSiteUrl()));
  }

  const session = await signInWithMagicToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", getSiteUrl()));
  }

  const safeDestination = safeNextPath(session.redirectPath || nextPath);
  return NextResponse.redirect(new URL(safeDestination, getSiteUrl()));
}

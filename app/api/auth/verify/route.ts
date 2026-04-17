import { NextResponse } from "next/server";
import { signInWithMagicToken } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  const nextPath = searchParams.get("next")?.trim();

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", getSiteUrl()));
  }

  const session = await signInWithMagicToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", getSiteUrl()));
  }

  const destination = session.redirectPath || nextPath || "/subscribe";
  const safeDestination = destination.startsWith("/") ? destination : "/subscribe";
  return NextResponse.redirect(new URL(safeDestination, getSiteUrl()));
}

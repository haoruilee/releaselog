import { cookies } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";
import { getAuthFromEmail } from "@/lib/mail-from";
import { sendMail } from "@/lib/mailer";
import {
  createMagicLinkToken,
  createSession,
  deleteSession,
  ensureNotificationPreferences,
  getActivePrivateFeedToken,
  getSubscriptionForUser,
  getUserFromSessionToken,
  rotatePrivateFeedToken,
  upsertUserByEmail,
  type NotificationPreferenceRecord,
  type SubscriptionRecord,
  type UserRecord,
} from "@/lib/account-store";
import { createOpaqueToken, normalizeEmail } from "@/lib/security";

const SESSION_COOKIE = "releaselog_session";

export type AuthenticatedUser = {
  user: UserRecord;
  subscription: SubscriptionRecord | null;
  preferences: NotificationPreferenceRecord | null;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) {
    return null;
  }
  const user = await getUserFromSessionToken(rawToken);
  if (!user) {
    return null;
  }
  const subscription = await getSubscriptionForUser(user.id);
  const preferences = await ensureNotificationPreferences(user.id);
  return { user, subscription, preferences };
}

export async function requestMagicLink(emailInput: string, redirectPath?: string | null): Promise<{ previewUrl?: string }> {
  const email = normalizeEmail(emailInput);
  const user = await upsertUserByEmail(email);
  await ensureNotificationPreferences(user.id);
  const subscription = await getSubscriptionForUser(user.id);

  const rawToken = createOpaqueToken(24);
  await createMagicLinkToken(user.id, rawToken, redirectPath);

  const verifyUrl = new URL("/api/auth/verify", getSiteUrl());
  verifyUrl.searchParams.set("token", rawToken);
  if (redirectPath) {
    verifyUrl.searchParams.set("next", redirectPath);
  }

  const from = getAuthFromEmail(subscription?.status);

  if (from) {
    try {
      await sendMail({
        from,
        to: email,
        subject: "Your ReleaseLog sign-in link",
        text: `Use this link to sign in to ReleaseLog: ${verifyUrl.toString()}`,
        html: `<p>Use this link to sign in to ReleaseLog:</p><p><a href="${verifyUrl.toString()}">${verifyUrl.toString()}</a></p>`,
      });
      return {};
    } catch {
      // Fall through to preview URL when mail delivery is unavailable.
    }
  }

  return { previewUrl: verifyUrl.toString() };
}

export async function signInWithMagicToken(rawToken: string): Promise<{ redirectPath: string | null } | null> {
  const consumed = await import("@/lib/account-store").then((module) => module.consumeMagicLinkToken(rawToken));
  if (!consumed) {
    return null;
  }

  const sessionToken = createOpaqueToken(24);
  await createSession(consumed.user.id, sessionToken);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  const activeFeed = await getActivePrivateFeedToken(consumed.user.id);
  if (!activeFeed) {
    await rotatePrivateFeedToken(consumed.user.id);
  }

  return { redirectPath: consumed.redirectPath };
}

export async function signOutCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await deleteSession(rawToken);
  }
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

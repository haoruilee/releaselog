import { isSubscriptionActive } from "@/lib/runtime-config";

function pickEmail(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

export function getVipFromEmail(): string | null {
  return pickEmail(process.env.VIP_FROM_EMAIL);
}

export function getSubscriberFromEmail(): string | null {
  return pickEmail(
    process.env.VIP_FROM_EMAIL,
    process.env.DIGEST_FROM_EMAIL,
    process.env.AUTH_FROM_EMAIL,
  );
}

export function getAuthFromEmail(subscriptionStatus?: string | null): string | null {
  if (isSubscriptionActive(subscriptionStatus)) {
    return pickEmail(
      process.env.VIP_FROM_EMAIL,
      process.env.AUTH_FROM_EMAIL,
      process.env.DIGEST_FROM_EMAIL,
    );
  }

  return pickEmail(
    process.env.AUTH_FROM_EMAIL,
    process.env.DIGEST_FROM_EMAIL,
    process.env.VIP_FROM_EMAIL,
  );
}

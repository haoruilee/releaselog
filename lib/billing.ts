import Stripe from "stripe";
import {
  getSubscriptionForUser,
  getUserByEmail,
  getUserById,
  getUserByStripeCustomerId,
  updateUserStripeCustomerId,
  upsertSubscription,
  type UserRecord,
} from "@/lib/account-store";
import { getSiteUrl } from "@/lib/site-url";

type BillingPlan = "monthly" | "yearly";

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

function getPriceId(plan: BillingPlan): string | null {
  if (plan === "yearly") {
    return process.env.STRIPE_PRICE_PRO_YEARLY?.trim() || null;
  }
  return process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() || null;
}

async function ensureStripeCustomer(user: UserRecord, stripe: Stripe): Promise<string> {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user.id,
    },
  });
  await updateUserStripeCustomerId(user.id, customer.id);
  return customer.id;
}

export async function createCheckoutSession(args: {
  userId: string;
  plan: BillingPlan;
  successPath?: string;
  cancelPath?: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("stripe_unconfigured");
  }
  const user = await getUserById(args.userId);
  if (!user) {
    throw new Error("user_not_found");
  }
  const priceId = getPriceId(args.plan);
  if (!priceId) {
    throw new Error("price_unconfigured");
  }
  const customerId = await ensureStripeCustomer(user, stripe);
  const base = getSiteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}${args.successPath ?? "/subscribe"}?checkout=success`,
    cancel_url: `${base}${args.cancelPath ?? "/subscribe"}?checkout=cancelled`,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      plan: args.plan,
    },
    allow_promotion_codes: true,
  });
  if (!session.url) {
    throw new Error("checkout_session_missing_url");
  }
  return session.url;
}

export async function createCustomerPortalUrl(userId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("stripe_unconfigured");
  }
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("user_not_found");
  }
  const subscription = await getSubscriptionForUser(userId);
  const customerId = subscription?.providerCustomerId ?? user.stripeCustomerId;
  if (!customerId) {
    throw new Error("customer_not_found");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getSiteUrl()}/subscribe`,
  });
  return session.url;
}

async function resolveUserIdFromCustomer(customerId: string): Promise<string | null> {
  const direct = await getUserByStripeCustomerId(customerId);
  if (direct) {
    return direct.id;
  }
  const stripe = getStripe();
  if (!stripe) return null;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const metadataUserId = customer.metadata?.userId;
  if (metadataUserId) {
    return metadataUserId;
  }
  if (customer.email) {
    const user = await getUserByEmail(customer.email);
    if (user) {
      await updateUserStripeCustomerId(user.id, customerId);
      return user.id;
    }
  }
  return null;
}

export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = await resolveUserIdFromCustomer(customerId);
  if (!userId) {
    return;
  }
  // Stripe moved current_period_end onto each subscription item in 2025-xx API versions.
  // Prefer the item-level value; fall back to the legacy top-level field for older payloads.
  const itemPeriodEnd = subscription.items?.data
    ?.map((item) => (item as unknown as { current_period_end?: number }).current_period_end)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => b - a)[0];
  const currentPeriodEnd =
    itemPeriodEnd ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;
  await updateUserStripeCustomerId(userId, customerId);
  await upsertSubscription({
    userId,
    providerCustomerId: customerId,
    providerSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

export async function syncCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  if (!userId || !customerId) {
    return;
  }
  await updateUserStripeCustomerId(userId, customerId);
  if (session.subscription) {
    await upsertSubscription({
      userId,
      providerCustomerId: customerId,
      providerSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription.id,
      status: "active",
    });
  }
}

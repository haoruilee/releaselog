import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getStripe,
  getStripeForMode,
  syncCheckoutSession,
  syncSubscriptionFromStripe,
} from "@/lib/billing";

function getWebhookSecrets(): string[] {
  return [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_LIVE_WEBHOOK_SECRET,
    process.env.STRIPE_TEST_WEBHOOK_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
}

function constructStripeEvent(stripe: Stripe, body: string, signature: string): Stripe.Event {
  const errors: string[] = [];
  for (const secret of getWebhookSecrets()) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors[0] ?? "stripe_webhook_secret_unconfigured");
}

export async function POST(request: Request) {
  const stripe = getStripe() ?? getStripeForMode(false) ?? getStripeForMode(true);
  if (!stripe || getWebhookSecrets().length === 0) {
    return NextResponse.json({ error: "stripe_unconfigured" }, { status: 503 });
  }

  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = constructStripeEvent(stripe, body, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const eventStripe = getStripeForMode(event.livemode);
  if (!eventStripe) {
    return NextResponse.json({ error: "stripe_mode_unconfigured" }, { status: 503 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await syncCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription, eventStripe);
      break;
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}

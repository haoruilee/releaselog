import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isSubscriptionActive } from "@/lib/runtime-config";
import { getPublicPricing } from "@/lib/billing";
import { PricingCheckoutButtons } from "@/components/PricingCheckoutButtons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ReleaseLog pricing: free public release logs and Atom feeds, plus a Pro plan with realtime email alerts and a private RSS feed scoped to the teams you track.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing · ReleaseLog",
    description:
      "Free public release logs. Pro adds realtime email alerts and a private RSS feed.",
  },
};

function formatPrice(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
  return formatter.format(amount);
}

export default async function PricingPage() {
  const [current, pricing] = await Promise.all([getCurrentUser(), getPublicPricing()]);
  const isPro = isSubscriptionActive(current?.subscription?.status);
  const checkoutEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

  const monthlyDisplay = pricing.monthly
    ? formatPrice(pricing.monthly.unitAmount, pricing.monthly.currency)
    : null;
  const yearlyDisplay = pricing.yearly
    ? formatPrice(pricing.yearly.unitAmount, pricing.yearly.currency)
    : null;

  const savingsLabel =
    pricing.monthly && pricing.yearly
      ? (() => {
          const annualIfMonthly = pricing.monthly.unitAmount * 12;
          const diff = annualIfMonthly - pricing.yearly.unitAmount;
          if (diff <= 0) return null;
          const pct = Math.round((diff / annualIfMonthly) * 100);
          return `Save ${pct}% vs monthly`;
        })()
      : null;

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary hover:text-primary"
          >
            ← ReleaseLog
          </Link>
          {current ? (
            <Link
              href="/subscribe"
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Manage subscription →
            </Link>
          ) : (
            <Link
              href="/login?next=/pricing"
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Sign in →
            </Link>
          )}
        </div>

        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
            Pricing
          </p>
          <h1 className="mt-2 font-serif text-4xl text-primary sm:text-5xl">
            Track every AI shipment without the noise.
          </h1>
          <p className="mt-4 text-base text-secondary sm:text-lg">
            ReleaseLog is a verified, time-ordered feed of product releases and platform updates
            from Anthropic, the Claude API team, Claude Product, and OpenAI. The public calendar
            and Atom feeds are free forever. Upgrade to Pro for realtime email alerts and a
            private RSS feed scoped to the teams you actually track.
          </p>
        </header>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <article className="flex flex-col rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
            <header>
              <h2 className="text-lg font-semibold text-primary">Free</h2>
              <p className="mt-1 text-sm text-secondary">
                For anyone who wants to keep an eye on AI platform shipping.
              </p>
              <p className="mt-6">
                <span className="font-serif text-4xl text-primary">$0</span>
                <span className="ml-2 text-sm text-secondary">forever</span>
              </p>
            </header>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-secondary">
              <li>• Full public release calendar for every tracked team</li>
              <li>• Public Atom / RSS feeds per team and a combined feed</li>
              <li>• Release detail pages with sources and footnotes</li>
              <li>• No account required</li>
            </ul>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex rounded-full border border-white/10 px-5 py-2 text-sm text-primary hover:bg-empty-cell/40"
              >
                Browse the calendar
              </Link>
            </div>
          </article>

          <article className="flex flex-col rounded-2xl bg-panel p-6 ring-1 ring-accent/40 md:-my-2 md:scale-[1.02]">
            <header>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-primary">Pro — Monthly</h2>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Most flexible
                </span>
              </div>
              <p className="mt-1 text-sm text-secondary">
                Email alerts and a private RSS feed that tracks only what you care about.
              </p>
              <p className="mt-6">
                {monthlyDisplay ? (
                  <>
                    <span className="font-serif text-4xl text-primary">{monthlyDisplay}</span>
                    <span className="ml-2 text-sm text-secondary">/ month, billed monthly</span>
                  </>
                ) : (
                  <span className="text-sm text-secondary">Pricing is being configured.</span>
                )}
              </p>
            </header>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-secondary">
              <li>• Realtime email alerts for every new release you follow</li>
              <li>• Private, signed RSS feed scoped to your selected teams</li>
              <li>• Weekly digest email (Monday) summarizing the prior week</li>
              <li>• Cancel or change plan any time from the billing portal</li>
              <li>• One-click unsubscribe in every email (RFC 8058)</li>
            </ul>
            <div className="mt-6">
              <PricingCheckoutButtons
                plan="monthly"
                label={monthlyDisplay ? `Start Pro Monthly — ${monthlyDisplay}/mo` : "Start Pro Monthly"}
                enabled={checkoutEnabled && Boolean(pricing.monthly)}
                isLoggedIn={Boolean(current)}
                isPro={isPro}
                primary
              />
            </div>
          </article>

          <article className="flex flex-col rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
            <header>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-primary">Pro — Yearly</h2>
                {savingsLabel && (
                  <span className="rounded-full bg-empty-cell/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {savingsLabel}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-secondary">
                Everything in Pro Monthly, billed once a year.
              </p>
              <p className="mt-6">
                {yearlyDisplay ? (
                  <>
                    <span className="font-serif text-4xl text-primary">{yearlyDisplay}</span>
                    <span className="ml-2 text-sm text-secondary">/ year, billed annually</span>
                  </>
                ) : (
                  <span className="text-sm text-secondary">Pricing is being configured.</span>
                )}
              </p>
            </header>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-secondary">
              <li>• All Pro Monthly features</li>
              <li>• Pay once; no month-to-month renewals</li>
              <li>• Cancel any time from the billing portal</li>
            </ul>
            <div className="mt-6">
              <PricingCheckoutButtons
                plan="yearly"
                label={yearlyDisplay ? `Start Pro Yearly — ${yearlyDisplay}/yr` : "Start Pro Yearly"}
                enabled={checkoutEnabled && Boolean(pricing.yearly)}
                isLoggedIn={Boolean(current)}
                isPro={isPro}
              />
            </div>
          </article>
        </section>

        <section className="mt-16 rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5">
          <h2 className="text-base font-semibold text-primary">What’s in Pro</h2>
          <dl className="mt-4 grid gap-6 text-sm text-secondary sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-primary">Realtime email alerts</dt>
              <dd className="mt-1">
                When an editor publishes a verified release for a team you track, you get an email
                within minutes. Plain text + HTML, with a visible unsubscribe link and RFC 8058
                one-click headers so Gmail and Yahoo can surface the unsubscribe UI natively.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-primary">Private RSS feed</dt>
              <dd className="mt-1">
                A signed URL unique to your account that only returns releases from the teams
                you selected. Paste it into any RSS reader. You can rotate the URL any time from
                the subscribe page if it leaks.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-primary">Weekly digest</dt>
              <dd className="mt-1">
                Every Monday at 09:00 UTC, Pro subscribers get a digest email summarizing the
                prior week’s releases for their selected teams. The system is idempotent —
                double-triggering never results in duplicate emails.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-primary">Control &amp; cancellation</dt>
              <dd className="mt-1">
                Manage billing, change plans, or cancel from the Stripe-hosted customer portal.
                One-click unsubscribe from any individual release email. Turn off email entirely
                while keeping RSS active — the preferences are independent.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-12 space-y-6">
          <h2 className="text-base font-semibold text-primary">FAQ</h2>
          <div className="space-y-5 text-sm text-secondary">
            <div>
              <p className="font-semibold text-primary">What exactly am I paying for?</p>
              <p className="mt-1">
                A subscription to the ReleaseLog Pro notification service: realtime email alerts,
                a private RSS feed, and the weekly digest. The underlying release data remains
                free to read in the public calendar and Atom feeds.
              </p>
            </div>
            <div>
              <p className="font-semibold text-primary">How do I cancel?</p>
              <p className="mt-1">
                Log in, open <Link href="/subscribe" className="text-accent underline-offset-4 hover:underline">Subscribe</Link>,
                click <em>Manage billing</em>. That opens the Stripe Customer Portal where you
                can cancel or change plans. Cancellation takes effect at the end of the current
                billing period.
              </p>
            </div>
            <div>
              <p className="font-semibold text-primary">Do you offer refunds?</p>
              <p className="mt-1">
                If the service does not work for you, email{" "}
                <a href="mailto:haoruileee@gmail.com" className="text-accent underline-offset-4 hover:underline">
                  haoruileee@gmail.com
                </a>{" "}
                within 7 days of your charge and we will refund in full. After that, cancel any
                time from the billing portal and no further charges will be made.
              </p>
            </div>
            <div>
              <p className="font-semibold text-primary">What payment methods are accepted?</p>
              <p className="mt-1">
                Checkout is powered by Stripe and accepts all major credit and debit cards. No
                card details are stored on our servers.
              </p>
            </div>
            <div>
              <p className="font-semibold text-primary">Can I try it before paying?</p>
              <p className="mt-1">
                Yes — the public calendar and Atom feeds are free and require no account. Those
                cover the same release data that Pro notifies you about; Pro only adds the
                realtime email + private RSS experience.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-white/5 pt-6 text-xs text-secondary">
          <p>
            Prices shown in USD. Taxes (if applicable) are calculated at checkout. By subscribing
            you agree that ReleaseLog will charge the displayed amount to your payment method on
            a recurring basis until cancelled. Contact:{" "}
            <a href="mailto:haoruileee@gmail.com" className="text-accent underline-offset-4 hover:underline">
              haoruileee@gmail.com
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}

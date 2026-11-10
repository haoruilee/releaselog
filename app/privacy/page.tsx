import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How ReleaseLog handles ordinary request data, optional account email, and advertising. Google AdSense is not enabled.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy policy · ReleaseLog",
    description:
      "Request data, account email, and advertising status for releaselog.site. Advertising is not enabled.",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary hover:text-primary"
        >
          ← ReleaseLog
        </Link>
        <h1 className="mt-4 font-serif text-4xl text-primary sm:text-5xl">Privacy policy</h1>
        <p className="mt-3 text-sm text-secondary">Last updated 10 November 2026.</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-secondary sm:text-base">
          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">What this site is</h2>
            <p>
              ReleaseLog at releaselog.site is a shipping calendar of AI release notes and
              related public events. Entries are checked against official sources: vendor
              announcements, help-center pages, changelogs, and event pages. The calendar
              covers Anthropic and Claude, including Claude product notes and the Claude API,
              plus OpenAI, Google DeepMind, DeepSeek, Mistral, xAI, vLLM, RadixArk, and a
              separate list of official AI events. A Reset Log records publicly announced
              quota and rate-limit changes for Anthropic&apos;s Claude Code and OpenAI&apos;s Codex.
            </p>
            <p>
              You can read the calendar, the Atom feeds, and the public JSON API without an
              account. This page describes the published site and the optional account
              features in this codebase. No separate legal-entity name or postal address is
              published for the site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Contact</h2>
            <p>
              Questions about this page, or a request about the account email described
              below, can go to{" "}
              <a
                href="mailto:haoruileee@gmail.com"
                className="text-accent underline-offset-4 hover:underline"
              >
                haoruileee@gmail.com
              </a>
              . That address is already published on the pricing page and the Reset Log. The
              public source repository is{" "}
              <a
                href="https://github.com/haoruilee/releaselog"
                className="text-accent underline-offset-4 hover:underline"
                rel="noopener noreferrer"
              >
                github.com/haoruilee/releaselog
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Request data</h2>
            <p>
              The public site is a Next.js application. Traffic to releaselog.site passes
              through Cloudflare, including a Cloudflare Tunnel to the origin server.
              Cloudflare and the origin receive ordinary connection data needed to deliver
              pages and protect the service. That can include your IP address, user agent,
              the URL you request, the time of the request, and a referrer if your browser
              sends one.
            </p>
            <p>
              This page does not state a retention period for those logs, because the project
              does not publish one. ReleaseLog does not sell the information described here.
            </p>
            <p>
              The typefaces are served by this site. Published pages do not load a third-party
              font service in the browser.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Cookies on this site</h2>
            <p>Two first-party cookies exist in this release. Neither is an advertising cookie.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="text-primary">releaselog_locale</span> is set only if you
                choose a language. It stores <span className="text-primary">en</span> or{" "}
                <span className="text-primary">zh</span>, lasts about one year, and uses
                SameSite=Lax. It is used to render the interface in that language. If the
                cookie is absent, the interface stays in English. The site does not read the
                Accept-Language header to pick a language.
              </li>
              <li>
                <span className="text-primary">releaselog_session</span> is set only after you
                finish a magic-link sign-in. It is HttpOnly, SameSite=Lax, and Secure in
                production. It lasts about 30 days and holds an opaque session token. The
                server stores a hash of that token.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Accounts, email, and payments</h2>
            <p>
              These points apply only if you use the account features. Those features run on
              the server deployment, not on a static export. The public calendar does not
              require them.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                If you request a sign-in link and the account database is configured,
                ReleaseLog stores the email address you submit, a hashed magic-link token,
                and, after you sign in, a hashed session.
              </li>
              <li>
                If you turn on notifications, ReleaseLog stores whether email and the private
                feed are enabled, and which teams you selected.
              </li>
              <li>
                A private feed token is stored as a hash. The feed URL shown while you are
                signed in contains the token a reader uses to fetch that feed.
              </li>
              <li>
                Pro checkout and the billing portal are Stripe pages. ReleaseLog stores a
                Stripe customer id and subscription status. Card numbers are handled by Stripe
                and are not stored in the ReleaseLog database.
              </li>
              <li>
                Sign-in messages and notification email are sent through the mail provider
                configured for that deployment, Resend or SMTP. That provider receives the
                address and the message.
              </li>
              <li>
                The optional weekly-email form, when Upstash Redis is configured, stores the
                address, the team ids you selected, and the time you submitted them. If Redis
                is not configured, that form does not keep the address.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Analytics</h2>
            <p>
              This release does not run an analytics product on the published site. The pages
              served at releaselog.site do not load Google Analytics, Google Tag Manager, or a
              similar measurement script.
            </p>
            <p>
              The source includes an optional Google Analytics tag. It is added to a build
              only when <span className="text-primary">NEXT_PUBLIC_GA_ID</span> is set at build
              time. That variable is not set for the current public site. If a later build sets
              it, Google can receive page-view data under Google&apos;s own terms, and this page
              should be updated first.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Advertising</h2>
            <p>
              Google AdSense and other advertising are not enabled in this release. Reserved
              spaces are layout placeholders, not live ads. They do not request an ad, load
              googlesyndication, or set an advertising cookie.{" "}
              <Link href="/ads.txt" className="text-accent underline-offset-4 hover:underline">
                /ads.txt
              </Link>{" "}
              is a comment that says advertising is disabled. It does not list a publisher
              account.
            </p>
            <p>
              If advertising is enabled later, third-party providers may use cookies or similar
              signals, subject to a consent setup and their own policies. Turning ads on
              requires the publisher configuration to be enabled, a valid AdSense publisher id,
              numeric slot ids, and an explicit consent signal. A Google-certified consent
              management platform is required before ads are served in regions where Google
              requires that consent, including the European Economic Area and the United
              Kingdom. This release does not include that consent popup. The consent
              integration is not configured, and the page does not send a consent grant.
            </p>
            <p>
              Background on Google&apos;s requirements, not a control on this site:{" "}
              <a
                href="https://support.google.com/adsense/answer/13554116"
                className="text-accent underline-offset-4 hover:underline"
                rel="noopener noreferrer"
              >
                certified CMP requirement
              </a>
              ,{" "}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                className="text-accent underline-offset-4 hover:underline"
                rel="noopener noreferrer"
              >
                how Google uses information from sites that use its services
              </a>
              , and{" "}
              <a
                href="https://policies.google.com/privacy"
                className="text-accent underline-offset-4 hover:underline"
                rel="noopener noreferrer"
              >
                Google&apos;s privacy policy
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Links away from ReleaseLog</h2>
            <p>
              Release entries link to official vendor pages. Those sites have their own
              practices. ReleaseLog does not control them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-2xl text-primary">Changes</h2>
            <p>
              If these practices change, including if advertising or analytics is turned on,
              this page will be updated and the date above will change.
            </p>
          </section>
        </div>

        <footer className="mt-16 border-t border-white/5 pt-6 text-xs text-secondary">
          <p>
            Contact:{" "}
            <a
              href="mailto:haoruileee@gmail.com"
              className="text-accent underline-offset-4 hover:underline"
            >
              haoruileee@gmail.com
            </a>
            {" · "}
            <a
              href="https://github.com/haoruilee/releaselog"
              className="text-accent underline-offset-4 hover:underline"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

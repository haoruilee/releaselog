import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

function metadataBaseUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return new URL(`https://${vercel.replace(/^https?:\/\//, "")}`);
  return new URL("http://localhost:3000");
}

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const DESCRIPTION =
  "ReleaseLog tracks verified AI product releases and platform updates from Anthropic, Claude API, Claude Product, and OpenAI on an interactive shipping calendar.";

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: { default: "ReleaseLog — AI Release Calendar & Changelog Tracker", template: "%s · ReleaseLog" },
  description: DESCRIPTION,
  keywords: ["release log", "AI releases", "Anthropic", "Claude", "OpenAI", "changelog", "shipping calendar"],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website",
    siteName: "ReleaseLog",
    title: "ReleaseLog — AI Release Calendar & Changelog Tracker",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "ReleaseLog — AI Release Calendar & Changelog Tracker",
    description: DESCRIPTION,
  },
  alternates: {
    types: {
      "application/atom+xml": "/feeds/atom.xml",
    },
  },
};

const gaId = process.env.NEXT_PUBLIC_GA_ID;
const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ReleaseLog",
  description: DESCRIPTION,
  url: getSiteUrl(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {adsenseId && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">{`
              window.dataLayer=window.dataLayer||[];
              function gtag(){dataLayer.push(arguments);}
              gtag('js',new Date());
              gtag('config','${gaId}');
            `}</Script>
          </>
        )}
      </body>
    </html>
  );
}

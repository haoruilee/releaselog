/**
 * Manual ad-slot requests stay off unless every gate passes.
 *
 * The publisher connection script is separate. Manual slots are disabled,
 * slot ids are null, and consentIntegration is
 * "not_configured". A future enablement also needs an explicit visitor grant
 * (`window.__RELEASELOG_AD_CONSENT__ === "granted"`) from a Google-certified
 * CMP. This module does not read or set that signal.
 */

export const AD_SLOT_KEYS = {
  homeBanner: "home-banner",
  articleInContent: "article-in-content",
  contentFooter: "content-footer",
} as const;

export type AdSlotKey = (typeof AD_SLOT_KEYS)[keyof typeof AD_SLOT_KEYS];

export const AD_CONSENT_GRANTED = "granted";

/** Set this only after a Google-certified CMP is actually deployed. */
export const AD_CONSENT_INTEGRATION_READY = "google_certified_cmp";

const CLIENT_ID_RE = /^ca-pub-\d{16}$/;
const SLOT_ID_RE = /^\d{8,12}$/;

export type PublisherConfig = {
  adsense?: {
    enabled?: boolean;
    clientId?: string | null;
    consentIntegration?: string;
    slots?: Record<string, string | null> | null;
  } | null;
};

export type AdRequestDecision =
  | { ok: true; clientId: string; slotId: string }
  | { ok: false };

export function canRequestAds(
  config: PublisherConfig,
  slotKey: string,
  consentSignal: unknown,
): AdRequestDecision {
  const ads = config?.adsense;
  if (!ads || ads.enabled !== true) return { ok: false };
  if (typeof ads.clientId !== "string" || !CLIENT_ID_RE.test(ads.clientId)) {
    return { ok: false };
  }
  const slotId = ads.slots?.[slotKey];
  if (typeof slotId !== "string" || !SLOT_ID_RE.test(slotId)) return { ok: false };
  if (ads.consentIntegration !== AD_CONSENT_INTEGRATION_READY) return { ok: false };
  if (consentSignal !== AD_CONSENT_GRANTED) return { ok: false };
  return { ok: true, clientId: ads.clientId, slotId };
}

export const AD_POSITIONS = ["calendar-banner", "reset-banner", "site-footer"] as const;
export type AdPosition = typeof AD_POSITIONS[number];
export type AdvertisingConfig = { client: string; slots: Record<AdPosition, string>; contactEmail: string; sponsor: { name: string; url: string; image: string } | null };
function httpsUrl(value: string | undefined): string {
  if (!value) return "";
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; }
}
export function getAdvertisingConfig(env: Record<string, string | undefined> = process.env): AdvertisingConfig {
  const candidate = env.ADSENSE_CLIENT_ID || env.NEXT_PUBLIC_ADSENSE_ID || "";
  const client = /^ca-pub-\d{16}$/.test(candidate) ? candidate : "";
  const slot = (name: string) => /^\d{5,20}$/.test(env[name] || "") ? env[name]! : "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.AD_CONTACT_EMAIL || "") ? env.AD_CONTACT_EMAIL! : "haoruileee@gmail.com";
  const name = env.SPONSOR_NAME?.trim().slice(0, 100) || ""; const url = httpsUrl(env.SPONSOR_URL); const image = httpsUrl(env.SPONSOR_IMAGE_URL);
  return { client, slots: { "calendar-banner": slot("ADSENSE_SLOT_CALENDAR"), "reset-banner": slot("ADSENSE_SLOT_RESET"), "site-footer": slot("ADSENSE_SLOT_FOOTER") }, contactEmail: email, sponsor: name && url ? { name, url, image } : null };
}
export function buildAdsTxt(client: string): string | null {
  return /^ca-pub-\d{16}$/.test(client) ? `google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n` : null;
}

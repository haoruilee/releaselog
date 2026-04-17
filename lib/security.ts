import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function privateFeedSecret(): string {
  return process.env.PRIVATE_FEED_SIGNING_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "dev-private-feed-secret";
}

export function buildPrivateFeedToken(tokenId: string): string {
  const signature = createHmac("sha256", privateFeedSecret()).update(tokenId).digest("base64url");
  return `${tokenId}.${signature}`;
}

export function parsePrivateFeedToken(rawToken: string): string | null {
  const [tokenId, signature] = rawToken.split(".");
  if (!tokenId || !signature) {
    return null;
  }
  const expected = buildPrivateFeedToken(tokenId).split(".")[1]!;
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  return tokenId;
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseDelimitedList(input: string): string[] {
  return input
    .split(/[\n,]/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function uniqueStrings(list: string[]): string[] {
  return [...new Set(list.map((item) => item.trim()).filter(Boolean))];
}

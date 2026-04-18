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

export function buildUnsubscribeToken(userId: string, target: string): string {
  const payload = `${userId}:${target}`;
  const payloadEncoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", privateFeedSecret()).update(payloadEncoded).digest("base64url");
  return `${payloadEncoded}.${signature}`;
}

export function parseUnsubscribeToken(rawToken: string): { userId: string; target: string } | null {
  if (!rawToken) return null;
  const dot = rawToken.lastIndexOf(".");
  if (dot <= 0 || dot === rawToken.length - 1) return null;
  const payloadEncoded = rawToken.slice(0, dot);
  const signature = rawToken.slice(dot + 1);
  const expected = createHmac("sha256", privateFeedSecret()).update(payloadEncoded).digest("base64url");
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }
  let payload: string;
  try {
    payload = Buffer.from(payloadEncoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const colon = payload.indexOf(":");
  if (colon <= 0 || colon === payload.length - 1) return null;
  const userId = payload.slice(0, colon);
  const target = payload.slice(colon + 1);
  if (!userId || !target) return null;
  return { userId, target };
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

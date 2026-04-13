import { Redis } from "@upstash/redis";

const LEADS_KEY = "subscribe:leads";

export type SubscribeLead = {
  email: string;
  entityIds: string[];
  createdAt: string;
};

export function getSubscribeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function appendSubscribeLead(lead: SubscribeLead): Promise<void> {
  const redis = getSubscribeRedis();
  if (!redis) {
    throw new Error("redis_unconfigured");
  }
  await redis.rpush(LEADS_KEY, JSON.stringify(lead));
}

export async function listSubscribeLeads(): Promise<SubscribeLead[]> {
  const redis = getSubscribeRedis();
  if (!redis) return [];
  const raw = await redis.lrange(LEADS_KEY, 0, -1);
  if (!raw || !Array.isArray(raw)) return [];
  const out: SubscribeLead[] = [];
  for (const row of raw) {
    if (typeof row !== "string") continue;
    try {
      const parsed = JSON.parse(row) as SubscribeLead;
      if (parsed.email && Array.isArray(parsed.entityIds)) {
        out.push(parsed);
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

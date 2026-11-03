import type { ResetEvent } from "../data/reset-log";

const AUTHORS = new Set(["thsottiaux", "openaidevs", "openai", "claudedevs", "claudeai", "lydiahallie", "bcherny"]);
export function sourcePost(url: unknown): { author: string; id: string; url: string } | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(u.hostname)) return null;
    const m = u.pathname.match(/^\/([a-zA-Z0-9_]+)\/status\/(\d{10,24})\/?$/);
    if (!m || !AUTHORS.has(m[1].toLowerCase())) return null;
    return { author: m[1], id: m[2], url: `https://x.com/${m[1]}/status/${m[2]}` };
  } catch { return null; }
}
export function validAnnouncementDate(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string") return null;
  const n = Date.parse(value);
  return Number.isFinite(n) && n >= Date.UTC(2023, 0, 1) && n <= now ? new Date(n).toISOString().slice(0, 10) : null;
}
export function parseCodexRecord(value: unknown, now = Date.now()): ResetEvent | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const source = sourcePost(r.announcementUrl);
  const date = validAnnouncementDate(r.announcementAtUtc ?? r.occurredAtUtc, now);
  if (!source || !date || !["global", "banked"].includes(String(r.type)) || /predict|forecast/i.test(String(r.status ?? ""))) return null;
  const banked = r.type === "banked";
  return { id: `codex-post-${source.id}`, slug: `codex-${banked ? "banked-credit" : "quota-reset"}-${source.id}`, date,
    agent: "codex", plans: ["See announcement for eligibility"], type: banked ? "banked_reset" : "manual_reset",
    title: banked ? "Codex banked reset credit announced" : "Codex quota reset announcement",
    summary: banked ? "A public announcement records a reset credit that eligible users may redeem. This is distinct from an automatic global reset." : "A public announcement records a Codex quota reset. Announcement time does not confirm when it reached an individual account.",
    source: { label: `@${source.author}`, url: source.url }, verification: "source-linked",
    secondarySources: [{ label: "Codex Resets archive", url: "https://willcodexresets.com/history" }] };
}
export function parseClaudePost(value: unknown, now = Date.now()): ResetEvent | null {
  if (!value || typeof value !== "object") return null;
  const t = value as { url?: string; text?: string; created_at?: string; author?: { screen_name?: string } };
  const source = sourcePost(t.url);
  if (!source || !["claudedevs", "claudeai", "lydiahallie", "bcherny"].includes(source.author.toLowerCase()) || source.author.toLowerCase() !== t.author?.screen_name?.toLowerCase()) return null;
  const date = validAnnouncementDate(t.created_at, now); const text = t.text ?? "";
  if (!date || /haven.t changed|no changes|no change to|API only|expires? tomorrow|send.*feedback|predic|forecast/i.test(text)) return null;
  let type: ResetEvent["type"];
  if (/banked|saved reset|reset to use anytime|reset for free/i.test(text)) type = "banked_reset";
  else if (/reset/i.test(text) && /limit|usage|quota|weekly|5.hour/i.test(text)) type = "manual_reset";
  else if (/(?:rais|increas|remov)[\s\S]{0,100}(?:limit|quota)|(?:limit|quota)[\s\S]{0,100}(?:increas|remov)/i.test(text)) type = "limit_increase";
  else if (/(?:reduc|lower)[\s\S]{0,70}(?:limit|quota)/i.test(text)) type = "limit_decrease";
  else return null;
  return { id: `claude-post-${source.id}`, slug: `claude-quota-update-${source.id}`, date, agent: "claude-code", plans: ["See announcement for affected plans"], type,
    title: type === "banked_reset" ? "Claude reset credit announced" : type === "manual_reset" ? "Claude usage reset announced" : "Claude usage limits updated",
    summary: "The source account announced a usage allowance change. Eligibility, timing, and individual account rollout remain subject to the original announcement.",
    source: { label: `@${source.author}`, url: source.url }, verification: "source-linked",
    secondarySources: [{ label: "LimitDigest source archive", url: "https://limitdigest.com/resets/claude/log/" }] };
}
export function mergeResetEvents(...lists: ResetEvent[][]): ResetEvent[] {
  const out: ResetEvent[] = []; const seen = new Set<string>(); const slugs = new Set<string>();
  for (const e of lists.flat()) {
    const post = sourcePost(e.source.url); const key = post ? `${e.agent}:${post.id}` : e.id;
    if (seen.has(key) || slugs.has(e.slug)) continue;
    seen.add(key); slugs.add(e.slug); out.push(e);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function parseSourcePost(value: unknown, now = Date.now()): ResetEvent | null {
  if (!value || typeof value !== "object") return null;
  const t = value as { url?: string; text?: string; created_at?: string; author?: { screen_name?: string } };
  const p = sourcePost(t.url); if (!p || p.author.toLowerCase() !== t.author?.screen_name?.toLowerCase()) return null;
  if (["claudedevs", "claudeai", "lydiahallie", "bcherny"].includes(p.author.toLowerCase())) return parseClaudePost(value, now);
  const text = t.text || "";
  if (!/reset/i.test(text) || /predict|forecast|no reset|not.*reset/i.test(text)) return null;
  const banked = /banked|reset credit|saved reset/i.test(text);
  if (!banked && /tomorrow|next (?:two |three )?days|by midnight|will.*reset/i.test(text)) return null;
  return parseCodexRecord({ announcementUrl: p.url, announcementAtUtc: t.created_at, type: banked ? "banked" : "global" }, now);
}

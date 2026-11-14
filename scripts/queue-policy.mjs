const DAY = 86400000;
export const QUEUE_POLICY = Object.freeze({ version: 2, maxAgeDays: 7, futureToleranceDays: 1 });
export function canonicalUrl(value) {
  try {
    const u = new URL(value); if (!['https:', 'http:'].includes(u.protocol)) return null;
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, ''); u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|s|ref|ref_src|fbclid|gclid|hl|auto_signin|silentLogin)$/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort(); u.pathname = u.pathname.replace(/\/+$/, '') || '/'; return u.href;
  } catch { return null; }
}
export function aggregateUrl(value) {
  try { const p = new URL(value).pathname.toLowerCase(); return p === '/' || /\/(?:docs|changelog|updates|release-notes)(?:\/|$)/.test(p) || /(?:release-notes|sitemap|rss|feed)/.test(p) || /\/(?:blog|news|releases)\/?$/.test(p); } catch { return true; }
}
const title = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const date = value => { const n = value ? Date.parse(value) : NaN; return Number.isFinite(n) ? n : null; };
const day = value => date(value) === null ? null : new Date(date(value)).toISOString().slice(0, 10);
// Only explicit publication headers near the start of an article count; dates in
// related links, prose, deadlines and update notices do not establish publication.
export function headerPublicationDate(body) {
  const m = String(body || '').slice(0, 900).match(/\bPublished\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!m) return null;
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].slice(0,3).toLowerCase())+1;
  const iso = `${m[3]}-${String(month).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  return day(iso) === iso ? iso : null;
}
export function planQueue(candidates, published, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('invalid_clock');
  const cutoff = now - QUEUE_POLICY.maxAgeDays * DAY;
  const publishedUrls = new Map(), publishedTitles = new Map();
  for (const p of published) {
    const entity = p.entity_id ?? p.entityId, url = canonicalUrl(p.source_url ?? p.sourceUrl), t = title(p.title), d = day(p.date);
    if (url && !aggregateUrl(url)) publishedUrls.set(`${entity}|${url}`, p.id);
    if (t.length >= 15 && d) publishedTitles.set(`${entity}|${d}|${t}`, p.id);
  }
  const rejected = [], kept = [], seen = new Map();
  for (const c of [...candidates].sort((a,b) => (date(b.created_at) ?? 0) - (date(a.created_at) ?? 0) || a.id.localeCompare(b.id))) {
    const created = date(c.created_at), announced = date(c.raw_published_at ?? headerPublicationDate(c.raw_body)), url = canonicalUrl(c.source_url), t = title(c.raw_title), d = day(c.raw_published_at);
    let reason, duplicateOf;
    if (created !== null && created < cutoff) reason = 'queue_age_expired';
    else if (announced !== null && announced < cutoff) reason = 'announcement_outside_freshness_window';
    else if (announced !== null && announced > now + QUEUE_POLICY.futureToleranceDays * DAY && c.entity_id !== 'ai-events') reason = 'unverified_future_announcement_date';
    else if (c.metadata?.eventType === 'page_change' && url && aggregateUrl(url) && /^(news|blog|announcements|publications)$/i.test(String(c.raw_title).trim())) reason = 'aggregate_index_not_announcement';
    else if (/\b(?:files? s[ -]1|roadshow)\b.*\b(?:sec|initial public offering)\b/i.test(String(c.raw_title))) reason = 'corporate_financing_not_product_release';
    else {
      duplicateOf = (url && publishedUrls.get(`${c.entity_id}|${url}`)) || (d && t.length >= 15 && publishedTitles.get(`${c.entity_id}|${d}|${t}`));
      if (duplicateOf) reason = 'already_published';
      else {
        const key = url && (!aggregateUrl(url) ? `${c.entity_id}|url|${url}` : d && t.length >= 15 ? `${c.entity_id}|${url}|${d}|${t}` : null);
        if (key && seen.has(key)) { reason = 'superseded_pending_snapshot'; duplicateOf = seen.get(key); }
        else if (key) seen.set(key, c.id);
      }
    }
    if (reason) rejected.push({ candidateId: c.id, action: 'reject', reason: `Queue maintenance v${QUEUE_POLICY.version}: ${reason}; seven-day rolling news queue, not historical backfill.${duplicateOf ? ' Represented by '+duplicateOf+'.' : ''}`, rule: reason, ...(duplicateOf ? { duplicateOf } : {}) });
    else kept.push(c);
  }
  return { policy: QUEUE_POLICY, plannedAt: new Date(now).toISOString(), cutoff: new Date(cutoff).toISOString(), rejected, kept };
}
export async function applyRejections(decisions, send, record = () => {}) {
  if (decisions.length > 5000 || decisions.some(d => d.action !== 'reject' || !d.candidateId || !d.reason) || new Set(decisions.map(d => d.candidateId)).size !== decisions.length) throw new Error('invalid_rejection_plan');
  const receipts = [];
  for (let offset = 0; offset < decisions.length; offset += 50) {
    const batch = decisions.slice(offset, offset + 50).map(({ candidateId, action, reason }) => ({ candidateId, action, reason }));
    const result = await send({ provider: 'queue-maintenance', command: `deterministic-queue-policy-v${QUEUE_POLICY.version}`, dryRun: false, decisions: batch });
    if (result.ok !== true || result.approved !== 0 || result.needsReview !== 0 || result.skipped?.length || result.rejected !== batch.length) throw new Error('rejection_apply_mismatch');
    receipts.push({ offset, count: batch.length, runId: result.runId, rejected: result.rejected }); await record(receipts);
  }
  return receipts;
}
export function applyFreshnessPolicy(outbox, candidates, now=Date.now()) {
  if(outbox?.intent!=='release_publish' || outbox.ready!==true || !Array.isArray(outbox.decisions)) return outbox;
  const entities=new Map(candidates.map(c=>[c.id,c.entityId ?? c.entity_id]));
  return {...outbox,decisions:outbox.decisions.map(d=>{
    if(d.action!=='approve')return d;
    const value=d.release?.date, announced=typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? date(value) : null;
    let reason;
    if(announced===null || day(value)!==value)reason='missing_or_invalid_verified_date';
    else if(announced<now-QUEUE_POLICY.maxAgeDays*DAY)reason='announcement_outside_freshness_window';
    else if(announced>now+QUEUE_POLICY.futureToleranceDays*DAY && entities.get(d.candidateId)!=='ai-events')reason='unverified_future_announcement_date';
    return reason ? {candidateId:d.candidateId,action:'reject',reason:`Queue freshness gate: ${reason}; no historical backfill.`} : d;
  })};
}

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { normalizeAutonomousOutbox } from './ai-autonomy.mjs';
import { sourcePost, validAnnouncementDate, parseCodexRecord, mergeResetEvents } from '../lib/reset-feed-core.ts';
const require = createRequire(import.meta.url);
let playwright;
if (process.env.EDITORIAL_PLAYWRIGHT_MODULE) playwright = require(process.env.EDITORIAL_PLAYWRIGHT_MODULE);
else { try { playwright = require('playwright'); } catch { playwright = require('playwright-core'); } }
const { chromium } = playwright;
const result = { schemaVersion: 1, runnerSHA256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), observedAt: new Date().toISOString(), method: 'Controlled fixtures on the designated builder; no model, database or external service is called by the checks.', groups: {} };
const candidate = [{ id: 'fixture-a' }];
const review = confidence => ({ intent: 'release_publish', ready: true, riskLevel: 'low', decisions: [{ candidateId: 'fixture-a', action: 'approve', confidence, release: { title: 'Synthetic release' } }] });
const accepted = normalizeAutonomousOutbox(review(.85), candidate);
const rejected = normalizeAutonomousOutbox(review(.84), candidate);
assert.equal(accepted.decisions[0].action, 'approve'); assert.equal(rejected.decisions[0].action, 'reject');
assert.throws(() => normalizeAutonomousOutbox({ ...review(.9), decisions: [] }, candidate), /incomplete/);
assert.throws(() => normalizeAutonomousOutbox({ ...review(.9), decisions: [{ candidateId: 'other', action: 'reject' }] }, candidate), /unknown/);
assert.throws(() => normalizeAutonomousOutbox({ ...review(.9), decisions: [review(.9).decisions[0], review(.9).decisions[0]] }, candidate), /duplicate/);
result.groups.reviewBoundary = { passed: true, cases: 5, atThreshold: accepted.decisions[0].action, belowThreshold: rejected.decisions[0].action, missingUnknownAndDuplicateDecisions: 'rejected by validation', limit: 'This tests the normalizer only. Confidence is a supplied score, not a calibrated probability of truth; no release was published.' };
const now = Date.parse('2026-11-10T00:00:00Z');
const record = { type: 'banked', announcementAtUtc: '2026-11-01T12:00:00Z', announcementUrl: 'https://x.com/openaidevs/status/9000000000000000000' };
// Deliberately fictional post ID. No request is made to this URL.
assert.equal(sourcePost(record.announcementUrl+'?s=20').id, sourcePost(record.announcementUrl).id);
assert.equal(validAnnouncementDate('2027-01-01T00:00:00Z', now), null);
assert.equal(parseCodexRecord({ ...record, status: 'forecast' }, now), null);
const a = parseCodexRecord(record, now); a.slug = 'already-published-fixture-slug';
const b = parseCodexRecord({ ...record, announcementUrl: record.announcementUrl+'?s=20' }, now);
const merged = mergeResetEvents([a], [b]);assert.equal(merged.length, 1);assert.equal(merged[0].slug, 'already-published-fixture-slug');assert.equal(merged[0].date, '2026-11-01');
result.groups.datesAndIdentity = { passed: true, cases: 6, queryVariants: 'one canonical post ID', futureDate: 'rejected', forecast: 'rejected', mergedRecords: merged.length, preservedSlug: merged[0].slug, retainedEventDate: merged[0].date, limit: 'Synthetic parser inputs only. A parser accepting a URL is not independent evidence that a real announcement happened.' };
const browser = await chromium.launch({ headless: true, ...(process.env.EDITORIAL_CHROME ? { executablePath: process.env.EDITORIAL_CHROME } : {}), args: process.env.EDITORIAL_NO_SANDBOX === '1' ? ['--no-sandbox'] : [] });
try {
 const page = await browser.newPage();
 const fixture = '<!doctype html><html><body>'+Array.from({length:3},()=>'<article data-guide-card></article>').join('')+'<script type="application/json">'+JSON.stringify(Array.from({length:3},()=>({ 'data-guide-card': true })))+'</script></body></html>';
 const count = async html => ({ rawMarkerOccurrences: html.split('data-guide-card').length-1, renderedArticleNodes: await page.evaluate(s => new DOMParser().parseFromString(s,'text/html').querySelectorAll('article[data-guide-card]').length, html) });
 const fixtureCounts=await count(fixture);assert.equal(fixtureCounts.rawMarkerOccurrences,6);assert.equal(fixtureCounts.renderedArticleNodes,3);
 result.groups.domCounting = { passed:true, fixture:fixtureCounts, limit:'DOMParser runs without executing scripts. This does not replace hydrated browser interaction tests.' };
 if(process.argv[3]){const snapshot=readFileSync(process.argv[3],'utf8');const counts=await count(snapshot);assert.equal(counts.renderedArticleNodes,3);result.groups.domCounting.publicSnapshot={url:'https://releaselog.site/guides',collectedAt:process.argv[4],...counts};}
} finally { await browser.close(); }
const hash=s=>createHash('sha256').update(s).digest('hex');
function plan(old,added){const merged={...old};for(const[name,value]of Object.entries(added)){if(name in merged)assert.equal(hash(merged[name]),hash(value),'immutable path collision');else merged[name]=value;}return merged;}
const old={'old-hash.js':'old bytes','shared-hash.css':'shared bytes'};const combined=plan(old,{'shared-hash.css':'shared bytes','new-hash.js':'new bytes'});assert.equal(Object.keys(combined).length,3);assert.equal(hash(combined['old-hash.js']),hash(old['old-hash.js']));assert.throws(()=>plan(old,{'old-hash.js':'different bytes'}),/collision/);
result.groups.staticAssets={passed:true,cases:3,oldFiles:2,mergedFiles:3,oldContentHashPreserved:true,changedBytesAtSamePath:'rejected',limit:'Small reproduction of the immutable-path check, not a test of all browser sessions, Docker provenance or database rollback.'};
writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));

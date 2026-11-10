import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { articles, sources } = JSON.parse(readFileSync(new URL('../data/editorial-guides.json', import.meta.url), 'utf8'));
assert.equal(articles.length, 7, 'This accepted batch must contain three guides and four project field notes');
assert.equal(articles.filter(a => a.genre === 'field-note').length, 4);
const evidence = JSON.parse(readFileSync(new URL('../public/research/editorial-field-checks-20261110.json', import.meta.url), 'utf8'));
assert(evidence.runnerSHA256 === createHash('sha256').update(readFileSync(new URL('./editorial-field-checks.mjs', import.meta.url))).digest('hex'), 'Published check record must match its runner source');
assert(evidence.schemaVersion === 1 && Object.values(evidence.groups).every(group => group.passed === true));
const sourceMap = new Map();
const hosts = new Set(['platform.claude.com', 'code.claude.com', 'docs.vllm.ai', 'github.com', 'releaselog.site']);
const today = new Date().toISOString().slice(0, 10);
for (const source of sources) {
  assert(!sourceMap.has(source.id), 'Duplicate source ID');
  const url = new URL(source.url);
  assert(url.protocol === 'https:' && hosts.has(url.hostname) && !url.username && !url.password, 'Primary source must use an approved official HTTPS host');
  if (url.hostname === 'github.com') assert(/^\/haoruilee\/releaselog\/blob\/[a-f0-9]{7,40}\//.test(url.pathname) && source.kind === 'project-record', 'Project source must pin our repository revision');
  if (url.hostname === 'releaselog.site') assert(url.pathname === '/research/editorial-field-checks-20261110.json' && source.kind === 'experiment');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.checked) && source.checked <= today, 'Invalid source-check date');
  sourceMap.set(source.id, source);
}
const slugs = new Set();
for (const article of articles) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) && !slugs.has(article.slug), 'Invalid or duplicate guide slug');
  slugs.add(article.slug);
  assert(article.title.length > 15 && article.title.length < 150 && article.description.length > 40, 'Guide needs a useful title and description');
  assert(article.sourceIds.length >= 2 && article.sourceIds.every(id => sourceMap.has(id)), 'Guide must cite at least two approved primary sources');
  assert((article.genre === 'field-note' || article.entityIds.length > 0) && article.entityIds.every(id => ['api-team', 'claude-product', 'vllm-team'].includes(id)), 'Unknown related release calendar');
  assert(article.publishedAt <= article.reviewedAt && article.reviewedAt <= today && article.reviewedAt.length === 10, 'Invalid editorial dates');
  if (article.genre === 'field-note') {
    assert(article.evidenceKeys?.length > 0 && article.evidenceKeys.every(key => evidence.groups[key]?.passed === true), 'Field note must link successful recorded checks');
    assert(article.evidenceScope?.length >= 60, 'Field note needs an explicit evidence scope');
    assert(article.sourceIds.includes('project-records'), 'Field note must link the published check record');
  }
  assert(article.sections.length >= 4 && article.sections.length <= 8);
  const kinds = new Set();
  for (const section of article.sections) {
    assert(['documented', 'analysis', 'example', 'checklist', 'observed'].includes(section.kind));
    kinds.add(section.kind);
    assert(section.heading.length > 3 && Array.isArray(section.paragraphs));
    assert(section.sourceIds.every(id => article.sourceIds.includes(id)), 'Section citation missing from guide sources');
    if (section.kind === 'documented' || section.kind === 'observed') assert(section.sourceIds.length > 0, 'Documented behaviour needs a citation');
    if (section.kind === 'checklist') assert(section.items?.length >= 3, 'Checklist needs concrete steps');
    for (const text of [...section.paragraphs, ...(section.items || [])]) assert(typeof text === 'string' && text.trim().length > 0);
  }
  for (const kind of article.genre === 'field-note' ? ['documented','observed','analysis','checklist'] : ['documented','analysis','example','checklist']) assert(kinds.has(kind), 'Missing required evidence/analysis distinction: '+kind);
  const body = article.sections.flatMap(s => [...s.paragraphs, ...(s.items || [])]).join(' ');
  const wordCount = body.trim().split(/\s+/).length;
  assert(wordCount >= 400 && wordCount <= 1000, `Guide body outside reviewed range: ${article.slug} (${wordCount})`);
  assert(!/we measured|our benchmark results|guaranteed approval|passed (?:the )?adsense/i.test(body), 'Unsupported first-hand or approval claim');
  console.log(`${article.slug}: ${wordCount} words, ${article.sourceIds.length} primary sources / project records`);
}
console.log('Editorial schema, references, dates, disclosures and content boundaries passed');

const featured = JSON.parse(readFileSync(new URL('../data/editorial-featured.json', import.meta.url), 'utf8'));
assert.equal(featured.length, 4);
assert(featured.every(item => articles.some(article => article.genre === 'field-note' && article.slug === item.slug && article.title === item.title)), 'Featured metadata must match accepted field notes');

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { articles, sources } = JSON.parse(readFileSync(new URL('../data/editorial-guides.json', import.meta.url), 'utf8'));
assert.equal(articles.length, 3, 'First editorial batch must contain three reviewed guides');
const sourceMap = new Map();
const hosts = new Set(['platform.claude.com', 'code.claude.com', 'docs.vllm.ai']);
const today = new Date().toISOString().slice(0, 10);
for (const source of sources) {
  assert(!sourceMap.has(source.id), 'Duplicate source ID');
  const url = new URL(source.url);
  assert(url.protocol === 'https:' && hosts.has(url.hostname) && !url.username && !url.password, 'Primary source must use an approved official HTTPS host');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.checked) && source.checked <= today, 'Invalid source-check date');
  sourceMap.set(source.id, source);
}
const slugs = new Set();
for (const article of articles) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) && !slugs.has(article.slug), 'Invalid or duplicate guide slug');
  slugs.add(article.slug);
  assert(article.title.length > 15 && article.title.length < 150 && article.description.length > 40, 'Guide needs a useful title and description');
  assert(article.sourceIds.length >= 2 && article.sourceIds.every(id => sourceMap.has(id)), 'Guide must cite at least two approved primary sources');
  assert(article.entityIds.length > 0 && article.entityIds.every(id => ['api-team', 'claude-product', 'vllm-team'].includes(id)), 'Unknown related release calendar');
  assert(article.publishedAt <= article.reviewedAt && article.reviewedAt <= today && article.reviewedAt.length === 10, 'Invalid editorial dates');
  assert(article.sections.length >= 4 && article.sections.length <= 8);
  const kinds = new Set();
  for (const section of article.sections) {
    assert(['documented', 'analysis', 'example', 'checklist'].includes(section.kind));
    kinds.add(section.kind);
    assert(section.heading.length > 3 && Array.isArray(section.paragraphs));
    assert(section.sourceIds.every(id => article.sourceIds.includes(id)), 'Section citation missing from guide sources');
    if (section.kind === 'documented') assert(section.sourceIds.length > 0, 'Documented behaviour needs a citation');
    if (section.kind === 'checklist') assert(section.items?.length >= 3, 'Checklist needs concrete steps');
    for (const text of [...section.paragraphs, ...(section.items || [])]) assert(typeof text === 'string' && text.trim().length > 0);
  }
  assert.equal(kinds.size, 4, 'Facts, analysis, hypothetical example and checklist must remain distinct');
  const body = article.sections.flatMap(s => [...s.paragraphs, ...(s.items || [])]).join(' ');
  const wordCount = body.trim().split(/\s+/).length;
  assert(wordCount >= 400 && wordCount <= 1000, `Guide body outside reviewed range: ${article.slug} (${wordCount})`);
  assert(!/we measured|our benchmark results|guaranteed approval|passed (?:the )?adsense/i.test(body), 'Unsupported first-hand or approval claim');
  console.log(`${article.slug}: ${wordCount} words, ${article.sourceIds.length} official sources`);
}
console.log('Editorial schema, references, dates, disclosures and content boundaries passed');

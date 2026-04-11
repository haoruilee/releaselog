/**
 * Validates entity JSON files listed in data/entity-registry.json.
 * Run: node scripts/validate-data.cjs
 */

const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const registryPath = join(root, "data", "entity-registry.json");
const entitiesDir = join(root, "data", "entities");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AUDIENCES = new Set(["end_user", "developer", "admin", "partner"]);
const STATUSES = new Set(["stable", "preview", "beta", "deprecated"]);

function fail(msg) {
  console.error(`validate-data: ${msg}`);
  process.exit(1);
}

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`cannot read JSON ${path}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function validateRelease(r, entityId, index) {
  const p = `entity "${entityId}" releases[${index}]`;
  assert(r && typeof r === "object", `${p}: must be an object`);
  assert(typeof r.id === "string" && r.id.length > 0, `${p}.id: non-empty string required`);
  assert(typeof r.date === "string" && DATE_RE.test(r.date), `${p}.date: YYYY-MM-DD required`);
  assert(typeof r.title === "string" && r.title.length > 0, `${p}.title: non-empty string required`);

  if (r.shortTitle !== undefined) {
    assert(typeof r.shortTitle === "string", `${p}.shortTitle: must be a string`);
  }
  if (r.slug !== undefined) {
    assert(typeof r.slug === "string" && r.slug.length > 0, `${p}.slug: non-empty string`);
    assert(/^[\w-]+$/.test(r.slug), `${p}.slug: use letters, digits, underscores, hyphens only`);
  }
  if (r.description !== undefined) {
    assert(typeof r.description === "string", `${p}.description: must be a string`);
  }
  if (r.whatChanged !== undefined) {
    assert(typeof r.whatChanged === "string", `${p}.whatChanged: must be a string`);
  }
  if (r.sourceUrl !== undefined) {
    assert(typeof r.sourceUrl === "string" && isHttpUrl(r.sourceUrl), `${p}.sourceUrl: valid http(s) URL`);
  }
  if (r.importance !== undefined) {
    assert([1, 2, 3].includes(r.importance), `${p}.importance: must be 1, 2, or 3`);
  }
  if (r.status !== undefined) {
    assert(STATUSES.has(r.status), `${p}.status: must be one of ${[...STATUSES].join(", ")}`);
  }
  if (r.audience !== undefined) {
    const aud = Array.isArray(r.audience) ? r.audience : [r.audience];
    assert(aud.length > 0, `${p}.audience: must be non-empty`);
    for (const a of aud) {
      assert(AUDIENCES.has(a), `${p}.audience: invalid value "${a}"`);
    }
  }
  if (r.tags !== undefined) {
    assert(Array.isArray(r.tags), `${p}.tags: must be an array`);
    for (const t of r.tags) {
      assert(typeof t === "string" && t.length > 0, `${p}.tags: non-empty strings only`);
    }
  }
  if (r.docUrls !== undefined) {
    assert(Array.isArray(r.docUrls), `${p}.docUrls: must be an array`);
    for (const u of r.docUrls) {
      assert(typeof u === "string" && isHttpUrl(u), `${p}.docUrls: valid http(s) URLs only`);
    }
  }
  if (r.relatedIds !== undefined) {
    assert(Array.isArray(r.relatedIds), `${p}.relatedIds: must be an array`);
    for (const id of r.relatedIds) {
      assert(typeof id === "string" && id.length > 0, `${p}.relatedIds: non-empty strings only`);
    }
  }
  if (r.howTo !== undefined) {
    assert(r.howTo && typeof r.howTo === "object", `${p}.howTo: must be an object`);
    assert(
      Array.isArray(r.howTo.steps) && r.howTo.steps.length > 0,
      `${p}.howTo.steps: non-empty array required`,
    );
    for (const step of r.howTo.steps) {
      assert(typeof step === "string" && step.length > 0, `${p}.howTo.steps: non-empty strings only`);
    }
    if (r.howTo.prerequisites !== undefined) {
      assert(Array.isArray(r.howTo.prerequisites), `${p}.howTo.prerequisites: must be an array`);
      for (const pr of r.howTo.prerequisites) {
        assert(typeof pr === "string" && pr.length > 0, `${p}.howTo.prerequisites: non-empty strings`);
      }
    }
  }
}

function validateEntity(raw, filename) {
  assert(raw && typeof raw === "object", `${filename}: root must be an object`);
  assert(typeof raw.id === "string" && raw.id.length > 0, `${filename}: id required`);
  assert(typeof raw.name === "string" && raw.name.length > 0, `${filename}: name required`);
  assert(raw.type === "team" || raw.type === "product", `${filename}: type must be "team" or "product"`);
  assert(Array.isArray(raw.releases), `${filename}: releases must be an array`);
  raw.releases.forEach((r, i) => validateRelease(r, raw.id, i));
}

const registry = readJson(registryPath);
assert(Array.isArray(registry.entities), "entity-registry.json: entities must be an array");

const globalIds = new Set();
const globalSlugs = new Map();
const allReleases = [];

for (const filename of registry.entities) {
  assert(typeof filename === "string" && filename.endsWith(".json"), `bad registry entry: ${filename}`);
  const path = join(entitiesDir, filename);
  assert(existsSync(path), `registry lists ${filename} but file missing at data/entities/${filename}`);
  const raw = readJson(path);
  validateEntity(raw, filename);

  for (const r of raw.releases) {
    if (globalIds.has(r.id)) {
      fail(`duplicate release id "${r.id}" (entity ${raw.id})`);
    }
    globalIds.add(r.id);
    allReleases.push({ entityId: raw.id, r });
    if (r.slug) {
      if (globalSlugs.has(r.slug)) {
        fail(`duplicate slug "${r.slug}" (entities ${globalSlugs.get(r.slug)} and ${raw.id})`);
      }
      globalSlugs.set(r.slug, raw.id);
    }
  }
}

for (const { entityId, r } of allReleases) {
  if (!r.relatedIds) continue;
  for (const ref of r.relatedIds) {
    assert(globalIds.has(ref), `entity "${entityId}" release "${r.id}": relatedIds references unknown id "${ref}"`);
  }
}

console.log(`validate-data: OK (${registry.entities.length} entities, ${globalIds.size} releases)`);

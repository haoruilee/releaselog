/**
 * Generates static data files for client-side consumption:
 *   public/data/<entityId>-releases.json  — releases only, fetched lazily
 *   data/entity-metas.json                — entity configs without releases, bundled
 *
 * Run via:  node scripts/gen-static-data.mjs
 * Also runs automatically as part of `npm run build` / `npm run dev`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const registry = JSON.parse(
  readFileSync(resolve(root, "data/entity-registry.json"), "utf8"),
);

mkdirSync(resolve(root, "public/data"), { recursive: true });

const metas = [];

for (const filename of registry.entities) {
  const entity = JSON.parse(
    readFileSync(resolve(root, `data/entities/${filename}`), "utf8"),
  );
  const { releases, ...meta } = entity;

  // Releases-only JSON — served from public/, fetched by client on demand
  writeFileSync(
    resolve(root, `public/data/${meta.id}-releases.json`),
    JSON.stringify(releases ?? []),
  );

  metas.push(meta);
}

// Entity metadata (no releases) — statically imported by client bundle
writeFileSync(
  resolve(root, "data/entity-metas.json"),
  JSON.stringify(metas, null, 2),
);

console.log(
  `gen-static-data: wrote ${metas.length} entity metas + ${metas.length} release files`,
);

import { entities } from "@/data";
import configuredRegistry from "@/data/source-registry.json";
import { ensureDb } from "@/lib/db";

export type ReleaseSourceType = "feed" | "github_releases" | "sitemap" | "page_change" | "browser_page";

export type RegisteredReleaseSource = {
  id: string;
  entityId: string;
  type: ReleaseSourceType;
  label: string;
  url: string;
  enabled?: boolean;
  pollIntervalSeconds?: number;
  priority?: number;
  config?: Record<string, unknown>;
};

type SourceRegistryFile = {
  sources?: RegisteredReleaseSource[];
};

export type ReleaseSourceRecord = {
  id: string;
  entityId: string;
  type: ReleaseSourceType;
  label: string;
  url: string;
  enabled: boolean;
  pollIntervalSeconds: number;
  priority: number;
  config: Record<string, unknown>;
};

function inferSourceType(url: string): ReleaseSourceType {
  const normalized = url.toLowerCase();
  if (normalized.includes("github.com/") && normalized.includes("/releases")) return "github_releases";
  if (normalized.endsWith("sitemap.xml") || normalized.includes("/sitemap")) return "sitemap";
  if (normalized.endsWith(".xml") || normalized.endsWith(".rss") || normalized.endsWith(".atom")) return "feed";
  return "page_change";
}

function defaultPollIntervalSeconds(type: ReleaseSourceType): number {
  if (type === "feed" || type === "github_releases") return 60;
  if (type === "sitemap") return 300;
  if (type === "browser_page") return 600;
  return 300;
}

function defaultPriority(type: ReleaseSourceType): number {
  if (type === "feed" || type === "github_releases") return 9;
  if (type === "sitemap") return 7;
  return 5;
}

function normalizeSource(source: RegisteredReleaseSource): ReleaseSourceRecord {
  const type = source.type ?? inferSourceType(source.url);
  return {
    id: source.id,
    entityId: source.entityId,
    type,
    label: source.label,
    url: source.url,
    enabled: source.enabled !== false,
    pollIntervalSeconds: Math.max(30, Math.floor(source.pollIntervalSeconds ?? defaultPollIntervalSeconds(type))),
    priority: Math.max(1, Math.min(10, Math.floor(source.priority ?? defaultPriority(type)))),
    config: source.config ?? {},
  };
}

export function getSourceRegistry(): ReleaseSourceRecord[] {
  const byId = new Map<string, ReleaseSourceRecord>();

  for (const entity of entities) {
    if (!entity.brandUrl) continue;
    const type = inferSourceType(entity.brandUrl);
    byId.set(
      `${entity.id}:brand`,
      normalizeSource({
        id: `${entity.id}:brand`,
        entityId: entity.id,
        type,
        label: entity.brandLine ?? `${entity.name} official source`,
        url: entity.brandUrl,
      }),
    );
  }

  const configured = configuredRegistry as SourceRegistryFile;
  for (const source of configured.sources ?? []) {
    byId.set(source.id, normalizeSource(source));
  }

  return [...byId.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export async function syncReleaseSources(): Promise<{ synced: number }> {
  const sql = await ensureDb();
  if (!sql) return { synced: 0 };
  const sources = getSourceRegistry();

  for (const source of sources) {
    await sql`
      insert into release_sources (
        id,
        entity_id,
        source_type,
        label,
        url,
        enabled,
        poll_interval_seconds,
        priority,
        config,
        next_fetch_at,
        updated_at
      )
      values (
        ${source.id},
        ${source.entityId},
        ${source.type},
        ${source.label},
        ${source.url},
        ${source.enabled},
        ${source.pollIntervalSeconds},
        ${source.priority},
        ${sql.json(source.config as never)},
        now(),
        now()
      )
      on conflict (id) do update
      set entity_id = excluded.entity_id,
          source_type = excluded.source_type,
          label = excluded.label,
          url = excluded.url,
          enabled = excluded.enabled,
          poll_interval_seconds = excluded.poll_interval_seconds,
          priority = excluded.priority,
          config = excluded.config,
          updated_at = now()
    `;
  }

  return { synced: sources.length };
}

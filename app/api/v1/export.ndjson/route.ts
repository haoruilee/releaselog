import { entities } from "@/data";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";

export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [];
  for (const e of entities) {
    for (const r of e.releases) {
      const row = {
        schemaVersion: API_SCHEMA_VERSION,
        entityId: e.id,
        entityName: e.name,
        ...r,
      };
      lines.push(JSON.stringify(row));
    }
  }
  const body = lines.join("\n") + (lines.length ? "\n" : "");
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

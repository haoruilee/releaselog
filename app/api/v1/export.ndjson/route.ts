import { unstable_noStore as noStore } from "next/cache";
import { API_SCHEMA_VERSION } from "@/lib/api-constants";
import { getMergedEntities } from "@/lib/releases-store";

export async function GET() {
  if (process.env.STATIC_EXPORT !== "1" && process.env.NEXT_PUBLIC_USE_SERVER_DATA !== "0") {
    noStore();
  }
  const entities = await getMergedEntities();
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

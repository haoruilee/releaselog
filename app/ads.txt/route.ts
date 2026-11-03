import { buildAdsTxt, getAdvertisingConfig } from "@/lib/advertising";
export const dynamic = "force-dynamic";
export function GET() {
  const body = buildAdsTxt(getAdvertisingConfig().client);
  return new Response(body || "No advertising seller configured.\n", { status: body ? 200 : 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": body ? "public, max-age=3600" : "no-store" } });
}

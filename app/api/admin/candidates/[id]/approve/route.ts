import { NextResponse } from "next/server";
import { approveCandidate } from "@/lib/candidates";
import { getCurrentUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { parseDelimitedList } from "@/lib/security";
import { isAdminEmail } from "@/lib/runtime-config";

type Params = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return [];
}

export async function POST(request: Request, context: Params) {
  const current = await getCurrentUser();
  if (!current || !isAdminEmail(current.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const form = await request.formData();

  const date = String(form.get("date") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const entityId = String(form.get("entityId") ?? "").trim();
  if (!date || !title || !entityId) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  await approveCandidate({
    candidateId: id,
    createdByUserId: current.user.id,
    entityId,
    date,
    title,
    shortTitle: String(form.get("shortTitle") ?? "").trim() || undefined,
    slug: String(form.get("slug") ?? "").trim() || undefined,
    description: String(form.get("description") ?? "").trim() || undefined,
    whatChanged: String(form.get("whatChanged") ?? "").trim() || undefined,
    sourceUrl: String(form.get("sourceUrl") ?? "").trim() || undefined,
    importance: Number(form.get("importance") ?? 1) as 1 | 2 | 3,
    tags: parseDelimitedList(String(form.get("tags") ?? "")),
    docUrls: parseDelimitedList(String(form.get("docUrls") ?? "")),
    audience: parseDelimitedList(String(form.get("audience") ?? "")),
    status: String(form.get("status") ?? "").trim() || undefined,
    relatedIds: parseDelimitedList(String(form.get("relatedIds") ?? "")),
    howToSteps: parseDelimitedList(String(form.get("howToSteps") ?? "")),
    howToPrerequisites: parseDelimitedList(String(form.get("howToPrerequisites") ?? "")),
  });

  return NextResponse.redirect(new URL("/admin/candidates?approved=1", getSiteUrl()));
}

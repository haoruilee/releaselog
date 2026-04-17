import { NextResponse } from "next/server";
import { rejectCandidate } from "@/lib/candidates";
import { getCurrentUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
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
  const reason = String(form.get("reason") ?? "Rejected by admin").trim();
  await rejectCandidate(id, reason || "Rejected by admin");
  return NextResponse.redirect(new URL("/admin/candidates?rejected=1", getSiteUrl()));
}

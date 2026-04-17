import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { candidateToReleaseDefaults, inferDateFromCandidate, listCandidates } from "@/lib/candidates";
import { isAdminEmail } from "@/lib/runtime-config";

export default async function AdminCandidatesPage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login?next=/admin/candidates");
  }
  if (!isAdminEmail(current.user.email)) {
    redirect("/subscribe");
  }

  const candidates = await listCandidates();

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-secondary">Admin</p>
            <h1 className="mt-2 font-serif text-3xl">Release candidates</h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/releases" className="text-accent underline-offset-4 hover:underline">
              Published releases
            </Link>
            <Link href="/admin/subscribers" className="text-accent underline-offset-4 hover:underline">
              Subscribers
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {candidates.length === 0 && (
            <div className="rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5 text-sm text-secondary">
              No candidates yet. Run the ingest cron or call `/api/cron/ingest`.
            </div>
          )}

          {candidates.map((candidate) => {
            const defaults = candidateToReleaseDefaults(candidate);
            return (
              <section
                key={candidate.id}
                className="grid gap-6 rounded-2xl bg-panel/50 p-6 ring-1 ring-white/5 lg:grid-cols-[1.1fr,1fr]"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-secondary">
                    <span>{candidate.status}</span>
                    <span>{candidate.entityId}</span>
                    <a href={candidate.sourceUrl} className="text-accent underline-offset-4 hover:underline">
                      Source
                    </a>
                  </div>
                  <h2 className="text-xl font-semibold text-primary">{candidate.rawTitle}</h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                    {candidate.rawBody || "No body captured."}
                  </p>
                </div>

                <div className="space-y-4">
                  <form
                    action={`/api/admin/candidates/${candidate.id}/approve`}
                    method="post"
                    className="space-y-3 rounded-xl bg-empty-cell/30 p-4 ring-1 ring-white/5"
                  >
                    <input type="hidden" name="entityId" value={candidate.entityId} />
                    <label className="block text-xs uppercase tracking-[0.18em] text-secondary">
                      Date
                      <input
                        type="date"
                        name="date"
                        defaultValue={defaults.date ?? inferDateFromCandidate(candidate)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-page/60 px-3 py-2 text-sm text-primary"
                      />
                    </label>
                    <label className="block text-xs uppercase tracking-[0.18em] text-secondary">
                      Title
                      <input
                        type="text"
                        name="title"
                        defaultValue={defaults.title}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-page/60 px-3 py-2 text-sm text-primary"
                      />
                    </label>
                    <label className="block text-xs uppercase tracking-[0.18em] text-secondary">
                      What changed
                      <textarea
                        name="whatChanged"
                        defaultValue={candidate.rawBody ?? ""}
                        rows={4}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-page/60 px-3 py-2 text-sm text-primary"
                      />
                    </label>
                    <label className="block text-xs uppercase tracking-[0.18em] text-secondary">
                      Source URL
                      <input
                        type="url"
                        name="sourceUrl"
                        defaultValue={candidate.sourceUrl}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-page/60 px-3 py-2 text-sm text-primary"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs uppercase tracking-[0.18em] text-secondary">
                        Tags
                        <input
                          type="text"
                          name="tags"
                          placeholder="comma,separated"
                          className="mt-2 w-full rounded-lg border border-white/10 bg-page/60 px-3 py-2 text-sm text-primary"
                        />
                      </label>
                      <label className="block text-xs uppercase tracking-[0.18em] text-secondary">
                        Audience
                        <input
                          type="text"
                          name="audience"
                          placeholder="developer,end_user"
                          className="mt-2 w-full rounded-lg border border-white/10 bg-page/60 px-3 py-2 text-sm text-primary"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        className="rounded-full bg-active-cell px-4 py-2 text-sm font-medium text-white"
                      >
                        Approve and publish
                      </button>
                    </div>
                  </form>

                  <form
                    action={`/api/admin/candidates/${candidate.id}/reject`}
                    method="post"
                    className="rounded-xl bg-empty-cell/20 p-4 ring-1 ring-white/5"
                  >
                    <label className="block text-xs uppercase tracking-[0.18em] text-secondary">
                      Reject reason
                      <input
                        type="text"
                        name="reason"
                        placeholder="Not a new release"
                        className="mt-2 w-full rounded-lg border border-white/10 bg-page/60 px-3 py-2 text-sm text-primary"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-3 rounded-full border border-white/10 px-4 py-2 text-sm text-primary"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

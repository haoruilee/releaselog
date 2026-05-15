import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getAdminMonitorData } from "@/lib/admin-monitor";
import { isAdminEmail } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function countValue(counts: Record<string, number>, key: string): number {
  return counts[key] ?? 0;
}

function statusTone(status: string): string {
  if (["published", "deployed", "completed", "healthy", "approved"].includes(status)) {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
  }
  if (["working", "ready", "injected", "queued", "pending", "running"].includes(status)) {
    return "bg-sky-500/15 text-sky-200 ring-sky-400/20";
  }
  if (["failed", "degraded", "rejected"].includes(status)) {
    return "bg-red-500/15 text-red-200 ring-red-400/20";
  }
  return "bg-empty-cell/60 text-secondary ring-white/10";
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  const className = tone === "neutral" ? "bg-empty-cell/60 text-secondary ring-white/10" : statusTone(tone);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${className}`}>{children}</span>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-lg bg-panel/55 p-4 ring-1 ring-white/5">
      <p className="text-xs uppercase tracking-[0.18em] text-secondary">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-primary">{value}</p>
      {detail && <p className="mt-2 text-sm text-secondary">{detail}</p>}
    </div>
  );
}

function CountBars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  if (entries.length === 0) {
    return <p className="text-sm text-secondary">No data yet.</p>;
  }
  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key}>
          <div className="mb-1 flex items-center justify-between text-xs text-secondary">
            <span>{key}</span>
            <span>{value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-empty-cell">
            <div className="h-full rounded-full bg-active-cell" style={{ width: `${Math.max(6, (value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg bg-panel/45 p-5 ring-1 ring-white/5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminMonitorPage() {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login?next=/admin/monitor");
  }
  if (!isAdminEmail(current.user.email)) {
    redirect("/subscribe");
  }

  const data = await getAdminMonitorData();
  if (!data) {
    return (
      <div className="min-h-screen bg-page text-primary">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-sm text-secondary">Database is not configured.</p>
        </div>
      </div>
    );
  }

  const latestRun = data.harnessRuns[0];
  const latestReview = data.aiReviewRuns[0];
  const lastRunText = data.headline.minutesSinceLastRun === null ? "No runs yet" : `${data.headline.minutesSinceLastRun}m ago`;

  return (
    <div className="min-h-screen bg-page text-primary">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-secondary">Admin Monitor</p>
            <h1 className="mt-2 font-serif text-3xl">Autonomous release operations</h1>
            <p className="mt-2 text-sm text-secondary">
              Updated {formatTime(data.generatedAt)} UTC · latest harness run {lastRunText}
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin/candidates" className="text-accent underline-offset-4 hover:underline">Candidates</Link>
            <Link href="/admin/releases" className="text-accent underline-offset-4 hover:underline">Releases</Link>
            <Link href="/admin/subscribers" className="text-accent underline-offset-4 hover:underline">Subscribers</Link>
          </nav>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Agent state" value={data.headline.agentHealth} detail={`${data.headline.latestHarnessProvider ?? "no provider"} · ${data.headline.latestHarnessIntent ?? "no intent"}`} />
          <Metric label="Pending candidates" value={data.headline.pendingCandidates} detail={`${countValue(data.counts.candidatesByStatus, "approved")} approved · ${countValue(data.counts.candidatesByStatus, "rejected")} rejected`} />
          <Metric label="Published 24h" value={data.headline.published24h} detail={latestReview ? `last apply ${formatDuration(latestReview.durationMs)}` : "no review runs"} />
          <Metric label="Source events 24h" value={data.headline.sourceEvents24h} detail={`${countValue(data.counts.jobsByStatus, "queued")} queued jobs`} />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr,0.75fr]">
          <Section
            title="Harness timeline"
            action={latestRun ? <Pill tone={latestRun.status}>{latestRun.status}</Pill> : null}
          >
            <div className="space-y-3">
              {data.harnessRuns.slice(0, 8).map((run) => (
                <div key={run.id} className="rounded-lg bg-empty-cell/30 p-4 ring-1 ring-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={run.status}>{run.status}</Pill>
                        <Pill tone={run.riskLevel ?? "neutral"}>{run.riskLevel ?? "risk n/a"}</Pill>
                        <span className="text-xs text-secondary">{run.provider} · {run.intent}</span>
                      </div>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary">
                        {String(run.metadata.summary ?? run.error ?? "No summary recorded.")}
                      </p>
                    </div>
                    <div className="text-right text-xs text-secondary">
                      <div>{formatTime(run.startedAt)}</div>
                      <div>{formatDuration(run.durationMs)}</div>
                    </div>
                  </div>
                  {run.error && <p className="mt-3 rounded-md bg-red-950/40 px-3 py-2 text-xs text-red-200">{run.error}</p>}
                  {Boolean(run.metadata.apply) && (
                    <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-page/60 p-3 text-xs text-secondary">
                      {JSON.stringify(run.metadata.apply, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-5">
            <Section title="Harness 24h">
              <CountBars counts={data.counts.harnessByStatus24h} />
            </Section>
            <Section title="Queue state">
              <CountBars counts={data.counts.jobsByStatus} />
            </Section>
            <Section title="Source mix">
              <CountBars counts={data.counts.sourcesByType} />
            </Section>
          </div>
        </div>

        <div className="mt-5">
          <Section
            title="Agent event stream"
            action={<Pill tone={data.harnessEvents[0]?.level === "error" ? "failed" : data.harnessEvents[0]?.phase ?? "neutral"}>{data.harnessEvents.length} events</Pill>}
          >
            <div className="overflow-hidden rounded-lg ring-1 ring-white/5">
              <table className="min-w-full divide-y divide-white/5 text-left text-sm">
                <thead className="bg-empty-cell/60 text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Phase</th>
                    <th className="px-3 py-2 font-medium">Run</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                    <th className="px-3 py-2 font-medium">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-panel/20">
                  {data.harnessEvents.slice(0, 18).map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-secondary">{formatTime(event.createdAt)}</td>
                      <td className="px-3 py-2"><Pill tone={event.level === "error" ? "failed" : event.phase}>{event.phase}</Pill></td>
                      <td className="px-3 py-2 text-xs text-secondary">{event.runId.slice(0, 8)}</td>
                      <td className="px-3 py-2">{event.message ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-secondary">
                        {event.provider ?? "harness"}{event.intent ? ` · ${event.intent}` : ""}
                      </td>
                    </tr>
                  ))}
                  {data.harnessEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-5 text-secondary">No harness events recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Section title="AI review applies">
            <div className="overflow-hidden rounded-lg ring-1 ring-white/5">
              <table className="min-w-full divide-y divide-white/5 text-left text-sm">
                <thead className="bg-empty-cell/60 text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Decisions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-panel/20">
                  {data.aiReviewRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="px-3 py-2 text-secondary">{formatTime(run.startedAt)}</td>
                      <td className="px-3 py-2">{run.provider}</td>
                      <td className="px-3 py-2"><Pill tone={run.status}>{run.status}</Pill></td>
                      <td className="px-3 py-2 text-secondary">{String(run.metadata.decisionCount ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Collector failures">
            <div className="space-y-3">
              {data.sourceFailures.length === 0 && <p className="text-sm text-secondary">No recent source failures.</p>}
              {data.sourceFailures.map((failure) => (
                <div key={failure.id} className="rounded-lg bg-empty-cell/30 p-3 ring-1 ring-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{failure.entityId} · {failure.label}</div>
                    <Pill tone="failed">{failure.statusCode ?? failure.status}</Pill>
                  </div>
                  <p className="mt-2 text-xs text-secondary">{failure.error ?? "No error message"} · {formatTime(failure.startedAt)}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <Section title="Recent candidates">
            <div className="space-y-3">
              {data.recentCandidates.map((candidate) => (
                <div key={candidate.id} className="rounded-lg bg-empty-cell/25 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{candidate.title}</p>
                    <Pill tone={candidate.status}>{candidate.status}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-secondary">{candidate.entityId} · {candidate.sourceLabel} · {formatTime(candidate.createdAt)}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Recent releases">
            <div className="space-y-3">
              {data.recentReleases.map((release) => (
                <div key={release.id} className="rounded-lg bg-empty-cell/25 p-3">
                  <p className="truncate text-sm font-medium">{release.title}</p>
                  <p className="mt-1 text-xs text-secondary">{release.entityId} · {release.date} · {formatTime(release.publishedAt)}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Late sources">
            <div className="space-y-3">
              {data.sourceLag.length === 0 && <p className="text-sm text-secondary">No enabled sources are more than 15 minutes late.</p>}
              {data.sourceLag.map((source) => (
                <div key={source.id} className="rounded-lg bg-empty-cell/25 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{source.label}</p>
                    <Pill tone="pending">{source.sourceType}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-secondary">{source.entityId} · due {formatTime(source.nextFetchAt)}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

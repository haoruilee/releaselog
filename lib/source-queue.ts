import { randomUUID } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { entities } from "@/data";
import { ensureDb } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { syncReleaseSources, type ReleaseSourceRecord, type ReleaseSourceType } from "@/lib/source-registry";

type SourceRow = {
  id: string;
  entity_id: string;
  source_type: ReleaseSourceType;
  label: string;
  url: string;
  enabled: boolean;
  poll_interval_seconds: number;
  priority: number;
  config: Record<string, unknown>;
};

type JobRow = {
  id: string;
  source_id: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
  source: SourceRow;
};

type CollectorEvent = {
  eventType: string;
  title: string;
  body: string | null;
  sourceUrl: string;
  publishedAt: string | null;
  fingerprint: string;
  confidence: number;
  raw: Record<string, unknown>;
};

type FetchResult = {
  statusCode: number;
  contentType: string;
  body: string;
  finalUrl: string;
};

type DuplicateRelease = {
  id: string;
  title: string;
  date: string;
  source: "static" | "runtime";
};

class FetchSourceError extends Error {
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePageFingerprintText(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\bUpdated:?\s+(?:just now|\d+\s+(?:minute|minutes|hour|hours|day|days)\s+ago)\b/gi, "Updated")
    .replace(/\bLast updated:?\s+(?:just now|\d+\s+(?:minute|minutes|hour|hours|day|days)\s+ago)\b/gi, "Last updated")
    .replace(/\bUpdated\s+\d+\s+(?:minute|minutes|hour|hours|day|days)\s+ago\b/gi, "Updated")
    .replace(/\b\d+\s+(?:minute|minutes|hour|hours)\s+ago\b/gi, "")
    .replace(/\bToday at \d{1,2}:\d{2}(?:\s?[AP]M)?\b/gi, "Today")
    .replace(/\bYesterday at \d{1,2}:\d{2}(?:\s?[AP]M)?\b/gi, "Yesterday")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReleaseTitle(value: string): string {
  return normalizeWhitespace(value)
    .replace(datedSectionPattern, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim();
}

function titleLooksSame(candidateTitle: string, releaseTitle: string): boolean {
  const candidate = normalizeReleaseTitle(candidateTitle);
  const release = normalizeReleaseTitle(releaseTitle);
  if (!candidate || !release || release.length < 8) return false;
  return candidate === release || candidate.includes(release) || release.includes(candidate);
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const datedSectionPattern = new RegExp(`\\b(${monthNames.join("|")})\\s+(\\d{1,2}),\\s+(\\d{4})\\b`, "g");

function monthNumber(month: string): string {
  const index = monthNames.findIndex((entry) => entry.toLowerCase() === month.toLowerCase());
  return String(Math.max(0, index) + 1).padStart(2, "0");
}

function dateFromMatch(match: RegExpExecArray): string {
  return `${match[3]}-${monthNumber(match[1] ?? "")}-${String(match[2] ?? "").padStart(2, "0")}`;
}

function titleFromDatedSection(dateText: string, sectionText: string): string {
  const withoutDate = normalizeWhitespace(sectionText.slice(dateText.length));
  const words = withoutDate.split(" ").filter(Boolean);
  const titleWords = words.slice(0, 14);
  return normalizeWhitespace(`${dateText} — ${titleWords.join(" ")}`) || dateText;
}

function eventsFromDatedReleaseSections(source: ReleaseSourceRecord, result: FetchResult, text: string): CollectorEvent[] {
  const normalized = normalizePageFingerprintText(text);
  const matches = [...normalized.matchAll(datedSectionPattern)];
  if (matches.length === 0) return [];

  const maxSections = Math.max(1, Math.min(20, getConfigNumber(source.config, "sectionLimit", 8)));
  return matches.slice(0, maxSections).map((match, index) => {
    const next = matches[index + 1];
    const section = normalizeWhitespace(normalized.slice(match.index ?? 0, next?.index ?? normalized.length)).slice(0, 2400);
    const dateText = match[0] ?? "";
    const publishedDate = dateFromMatch(match);
    const title = titleFromDatedSection(dateText, section);
    const fingerprintSource = `${source.id}\n${publishedDate}\n${result.finalUrl}\n${section.slice(0, 1200)}`;
    return {
      eventType: "release_note_section",
      title,
      body: section,
      sourceUrl: result.finalUrl,
      publishedAt: `${publishedDate}T00:00:00.000Z`,
      fingerprint: sha256(fingerprintSource),
      confidence: 0.78,
      raw: {
        extractor: "dated_release_sections",
        sourceExtractor: source.type,
        contentType: result.contentType,
        sectionDate: publishedDate,
      },
    };
  });
}

function getConfigNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = Number(config[key]);
  return Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getLink(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(getLink).find(Boolean) ?? null;
  const record = asRecord(value);
  if (!record) return null;
  return String(record.href ?? record.url ?? "").trim() || null;
}

async function fetchText(url: string, source: ReleaseSourceRecord): Promise<FetchResult> {
  const headers: Record<string, string> = {
    "User-Agent": "ReleaseLogBot/2.0 (+https://releaselog.site)",
    Accept: "text/html,application/xml,text/xml,application/rss+xml,application/atom+xml,application/json;q=0.9,*/*;q=0.8",
  };
  const githubToken = process.env.GITHUB_TOKEN?.trim();
  if (githubToken && url.includes("api.github.com")) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) {
    const error = new FetchSourceError(`fetch_failed:${response.status}`);
    error.statusCode = response.status;
    error.metadata = { finalUrl: response.url };
    throw error;
  }
  return {
    statusCode: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body: await response.text(),
    finalUrl: response.url || source.url,
  };
}

async function fetchBrowserText(source: ReleaseSourceRecord): Promise<FetchResult> {
  const endpoint = process.env.BROWSERLESS_CONTENT_URL?.trim();
  if (!endpoint) {
    throw new Error("browser_collector_unconfigured");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: source.url }),
  });
  if (!response.ok) {
    const error = new FetchSourceError(`browser_fetch_failed:${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return {
    statusCode: response.status,
    contentType: response.headers.get("content-type") ?? "text/html",
    body: await response.text(),
    finalUrl: source.url,
  };
}

function eventsFromFeed(source: ReleaseSourceRecord, result: FetchResult): CollectorEvent[] {
  const parsed = xmlParser.parse(result.body) as Record<string, unknown>;
  const root = (parsed.feed ?? parsed.rss) as Record<string, unknown> | undefined;
  if (!root) return eventsFromPage(source, result);
  const channel = asRecord(root.channel);
  const rawEntries = (root.entry ?? channel?.item ?? []) as unknown;
  const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
  const limit = Math.max(1, Math.min(20, getConfigNumber(source.config, "entryLimit", 5)));

  return entries
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .slice(0, limit)
    .map((entry) => {
      const title = String(entry.title ?? "Feed updated").trim();
      const publishedAt = String(entry.updated ?? entry.published ?? entry.pubDate ?? "").trim() || null;
      const sourceUrl = getLink(entry.link) ?? getLink(entry.id) ?? getLink(entry.guid) ?? source.url;
      const body = String(entry.summary ?? entry.description ?? entry.content ?? "").slice(0, 2400);
      const fingerprintSource = `${title}\n${publishedAt ?? ""}\n${sourceUrl}\n${body}`.trim();
      return {
        eventType: "feed_entry",
        title,
        body,
        sourceUrl,
        publishedAt,
        fingerprint: sha256(fingerprintSource),
        confidence: 0.92,
        raw: { extractor: "feed", contentType: result.contentType },
      };
    });
}

function parseGitHubReleaseUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/|$)/i);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]!.replace(/\.git$/, "") };
}

async function eventsFromGitHubReleases(source: ReleaseSourceRecord): Promise<CollectorEvent[]> {
  const repo = parseGitHubReleaseUrl(source.url);
  if (!repo) return eventsFromPage(source, await fetchText(source.url, source));
  const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases?per_page=5`;
  const result = await fetchText(apiUrl, source);
  const releases = JSON.parse(result.body) as Array<Record<string, unknown>>;
  return releases.slice(0, 5).map((release) => {
    const title = String(release.name ?? release.tag_name ?? "GitHub release").trim();
    const publishedAt = String(release.published_at ?? release.created_at ?? "").trim() || null;
    const sourceUrl = String(release.html_url ?? source.url);
    const body = String(release.body ?? "").slice(0, 2400);
    return {
      eventType: "github_release",
      title,
      body,
      sourceUrl,
      publishedAt,
      fingerprint: sha256(`${sourceUrl}\n${title}\n${publishedAt ?? ""}\n${body}`),
      confidence: 0.96,
      raw: {
        extractor: "github_releases",
        tag: release.tag_name,
        prerelease: release.prerelease,
        draft: release.draft,
      },
    };
  });
}

function eventsFromSitemap(source: ReleaseSourceRecord, result: FetchResult): CollectorEvent[] {
  const parsed = xmlParser.parse(result.body) as Record<string, unknown>;
  const urlset = asRecord(parsed.urlset);
  const rawUrls = urlset?.url ?? [];
  const entries = Array.isArray(rawUrls) ? rawUrls : [rawUrls];
  const limit = Math.max(1, Math.min(20, getConfigNumber(source.config, "entryLimit", 5)));
  return entries
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry?.loc))
    .sort((a, b) => String(b.lastmod ?? "").localeCompare(String(a.lastmod ?? "")))
    .slice(0, limit)
    .map((entry) => {
      const sourceUrl = String(entry.loc);
      const title = sourceUrl.replace(/\/$/, "").split("/").pop()?.replace(/[-_]/g, " ") || `${source.label} sitemap update`;
      const publishedAt = String(entry.lastmod ?? "").trim() || null;
      return {
        eventType: "sitemap_url",
        title,
        body: null,
        sourceUrl,
        publishedAt,
        fingerprint: sha256(`${sourceUrl}\n${publishedAt ?? ""}`),
        confidence: 0.72,
        raw: { extractor: "sitemap" },
      };
    });
}

function eventsFromPage(source: ReleaseSourceRecord, result: FetchResult): CollectorEvent[] {
  const text = stripHtml(result.body);
  if (source.config.extractDatedSections === true) {
    const sectionEvents = eventsFromDatedReleaseSections(source, result, text);
    if (sectionEvents.length > 0) {
      return sectionEvents;
    }
  }
  const titleMatch = result.body.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || `${source.label} updated`;
  const snippet = text.slice(0, 2400);
  const fingerprintText = normalizePageFingerprintText(text).slice(0, 12000);
  return [
    {
      eventType: "page_change",
      title,
      body: snippet,
      sourceUrl: result.finalUrl,
      publishedAt: null,
      fingerprint: sha256(`${result.finalUrl}\n${fingerprintText}`),
      confidence: source.type === "browser_page" ? 0.56 : 0.5,
      raw: { extractor: source.type, contentType: result.contentType, stableFingerprint: true },
    },
  ];
}

async function collectSourceEvents(source: ReleaseSourceRecord): Promise<{ events: CollectorEvent[]; statusCode: number; metadata: Record<string, unknown> }> {
  if (source.type === "github_releases") {
    const events = await eventsFromGitHubReleases(source);
    return { events, statusCode: 200, metadata: { collector: "github_releases" } };
  }

  let result: FetchResult;
  try {
    result = source.type === "browser_page" ? await fetchBrowserText(source) : await fetchText(source.url, source);
  } catch (error) {
    if (source.config.browserFallback === true) {
      result = await fetchBrowserText(source);
    } else {
      throw error;
    }
  }

  if (source.type === "feed" || result.contentType.includes("xml") || result.body.includes("<feed") || result.body.includes("<rss")) {
    return { events: eventsFromFeed(source, result), statusCode: result.statusCode, metadata: { collector: "feed", finalUrl: result.finalUrl } };
  }
  if (source.type === "sitemap") {
    return { events: eventsFromSitemap(source, result), statusCode: result.statusCode, metadata: { collector: "sitemap", finalUrl: result.finalUrl } };
  }
  return { events: eventsFromPage(source, result), statusCode: result.statusCode, metadata: { collector: source.type, finalUrl: result.finalUrl } };
}

function mapSource(row: SourceRow): ReleaseSourceRecord {
  return {
    id: row.id,
    entityId: row.entity_id,
    type: row.source_type,
    label: row.label,
    url: row.url,
    enabled: row.enabled,
    pollIntervalSeconds: row.poll_interval_seconds,
    priority: row.priority,
    config: row.config ?? {},
  };
}

async function findDuplicateRelease(source: ReleaseSourceRecord, event: CollectorEvent): Promise<DuplicateRelease | null> {
  const eventDate = event.publishedAt?.slice(0, 10) ?? null;
  if (!eventDate) return null;
  const allowBodyMatch = event.eventType !== "release_note_section";

  const entity = entities.find((entry) => entry.id === source.entityId);
  const staticMatch = entity?.releases.find((release) => (
    release.date === eventDate &&
    (titleLooksSame(event.title, release.title) || Boolean(allowBodyMatch && event.body && titleLooksSame(event.body, release.title)))
  ));
  if (staticMatch) {
    return {
      id: staticMatch.id,
      title: staticMatch.title,
      date: staticMatch.date,
      source: "static",
    };
  }

  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<Array<{ id: string; title: string; date: string }>>`
    select id, title, date
    from published_releases
    where entity_id = ${source.entityId}
      and date = ${eventDate}
    order by published_at desc
    limit 50
  `;
  const runtimeMatch = rows.find((release) => (
    titleLooksSame(event.title, release.title) || Boolean(allowBodyMatch && event.body && titleLooksSame(event.body, release.title))
  ));
  return runtimeMatch ? { ...runtimeMatch, source: "runtime" } : null;
}

export async function enqueueDueSourceJobs(limit = 100): Promise<{ synced: number; enqueued: number }> {
  const sql = await ensureDb();
  if (!sql) return { synced: 0, enqueued: 0 };
  const { synced } = await syncReleaseSources();
  const sources = await sql<SourceRow[]>`
    select *
    from release_sources s
    where s.enabled = true
      and s.next_fetch_at <= now()
      and not exists (
        select 1
        from fetch_jobs j
        where j.source_id = s.id
          and j.job_type = 'fetch_source'
          and j.status in ('queued','running')
      )
    order by s.priority desc, s.next_fetch_at asc, s.id asc
    limit ${limit}
  `;

  for (const source of sources) {
    await sql`
      insert into fetch_jobs (id, source_id, job_type, status, priority, run_after, max_attempts, payload)
      values (${randomUUID()}, ${source.id}, ${"fetch_source"}, ${"queued"}, ${source.priority}, now(), ${3}, ${sql.json({} as never)})
    `;
    await sql`
      update release_sources
      set last_scheduled_at = now(),
          next_fetch_at = now() + (${source.poll_interval_seconds} * interval '1 second'),
          updated_at = now()
      where id = ${source.id}
    `;
  }

  return { synced, enqueued: sources.length };
}

async function claimFetchJobs(workerId: string, limit: number): Promise<JobRow[]> {
  const sql = await ensureDb();
  if (!sql) return [];
  return sql<JobRow[]>`
    with picked as (
      select id
      from fetch_jobs
      where job_type = 'fetch_source'
        and run_after <= now()
        and (
          status = 'queued'
          or (status = 'running' and locked_at < now() - interval '10 minutes')
        )
      order by priority desc, run_after asc, created_at asc
      limit ${limit}
      for update skip locked
    ),
    updated as (
      update fetch_jobs
      set status = 'running',
          locked_at = now(),
          locked_by = ${workerId},
          attempts = attempts + 1,
          updated_at = now()
      where id in (select id from picked)
      returning *
    )
    select
      updated.id,
      updated.source_id,
      updated.attempts,
      updated.max_attempts,
      updated.payload,
      to_jsonb(s.*) as source
    from updated
    join release_sources s on s.id = updated.source_id
  `;
}

async function createCandidateForEvent(source: ReleaseSourceRecord, event: CollectorEvent, eventId: string): Promise<string | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const duplicate = await sql<Array<{ id: string }>>`
    select id
    from release_candidates
    where source_id = ${source.id}
      and source_fingerprint = ${event.fingerprint}
    limit 1
  `;
  if (duplicate[0]) return duplicate[0].id;

  const duplicateRelease = await findDuplicateRelease(source, event);
  const candidateId = randomUUID();
  await sql`
    insert into release_candidates (
      id,
      entity_id,
      source_id,
      source_label,
      source_url,
      source_fingerprint,
      raw_title,
      raw_body,
	      raw_published_at,
	      status,
	      fetched_at,
	      rejection_reason,
	      metadata,
	      created_at,
	      updated_at
    )
    values (
      ${candidateId},
      ${source.entityId},
      ${source.id},
      ${source.label},
      ${event.sourceUrl},
      ${event.fingerprint},
      ${event.title},
      ${event.body},
      ${event.publishedAt ? new Date(event.publishedAt).toISOString() : null},
      ${duplicateRelease ? "rejected" : "pending"},
      now(),
      ${duplicateRelease ? `Already represented by ${duplicateRelease.source} release ${duplicateRelease.id}: ${duplicateRelease.title}` : null},
      ${sql.json({
        ...event.raw,
        releaseEventId: eventId,
        confidence: event.confidence,
        eventType: event.eventType,
        autoReview: duplicateRelease
          ? {
              action: "reject",
              reason: "deterministic_duplicate_release",
              duplicateRelease,
              reviewedAt: new Date().toISOString(),
            }
          : undefined,
      } as never)},
      now(),
      now()
    )
  `;
  return candidateId;
}

async function processFetchJob(workerId: string, job: JobRow): Promise<{ created: number; unchanged: number; failed: number; errors: string[] }> {
  const sql = await ensureDb();
  if (!sql) return { created: 0, unchanged: 0, failed: 1, errors: ["db_unconfigured"] };
  const source = mapSource(job.source);
  const runId = randomUUID();
  await sql`
    insert into source_fetch_runs (id, source_id, job_id, status, started_at)
    values (${runId}, ${source.id}, ${job.id}, ${"running"}, now())
  `;

  try {
    const result = await collectSourceEvents(source);
    const aggregateFingerprint = sha256(result.events.map((event) => event.fingerprint).join("\n"));
    let created = 0;
    let unchanged = 0;
    let lastCandidateId: string | null = null;

    for (const event of result.events) {
      const eventId = randomUUID();
      const inserted = await sql<Array<{ id: string }>>`
        insert into release_events (
          id,
          source_id,
          entity_id,
          event_type,
          title,
          body,
          source_url,
          published_at,
          fingerprint,
          confidence,
          raw
        )
        values (
          ${eventId},
          ${source.id},
          ${source.entityId},
          ${event.eventType},
          ${event.title},
          ${event.body},
          ${event.sourceUrl},
          ${event.publishedAt ? new Date(event.publishedAt).toISOString() : null},
          ${event.fingerprint},
          ${event.confidence},
          ${sql.json(event.raw as never)}
        )
        on conflict (source_id, fingerprint) do nothing
        returning id
      `;
      if (!inserted[0]) {
        unchanged += 1;
        continue;
      }
      const candidateId = await createCandidateForEvent(source, event, inserted[0].id);
      if (candidateId) {
        lastCandidateId = candidateId;
        created += 1;
        await sql`update release_events set candidate_id = ${candidateId} where id = ${inserted[0].id}`;
      }
    }

    await sql`
      insert into source_checkpoints (source_id, entity_id, url, last_fingerprint, last_fetched_at, last_candidate_id)
      values (${source.id}, ${source.entityId}, ${source.url}, ${aggregateFingerprint || null}, now(), ${lastCandidateId})
      on conflict (source_id) do update
      set entity_id = excluded.entity_id,
          url = excluded.url,
          last_fingerprint = excluded.last_fingerprint,
          last_fetched_at = excluded.last_fetched_at,
          last_candidate_id = coalesce(excluded.last_candidate_id, source_checkpoints.last_candidate_id)
    `;
    await sql`
      update source_fetch_runs
      set status = ${"ok"},
          finished_at = now(),
          status_code = ${result.statusCode},
          fingerprint = ${aggregateFingerprint || null},
          metadata = ${sql.json({ ...result.metadata, eventCount: result.events.length, created, unchanged } as never)}
      where id = ${runId}
    `;
    await sql`
      update fetch_jobs
      set status = ${"done"},
          finished_at = now(),
          updated_at = now(),
          error = null
      where id = ${job.id}
    `;
    return { created, unchanged, failed: 0, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error instanceof FetchSourceError ? error.statusCode ?? null : null;
    await sql`
      update source_fetch_runs
      set status = ${"failed"},
          finished_at = now(),
          status_code = ${statusCode},
          error = ${message},
          metadata = ${sql.json(((error as FetchSourceError).metadata ?? {}) as never)}
      where id = ${runId}
    `;
    if (job.attempts < job.max_attempts) {
      const retrySeconds = Math.min(900, 30 * 2 ** Math.max(0, job.attempts - 1));
      await sql`
        update fetch_jobs
        set status = ${"queued"},
            run_after = now() + (${retrySeconds} * interval '1 second'),
            locked_at = null,
            locked_by = null,
            error = ${message},
            updated_at = now()
        where id = ${job.id}
      `;
    } else {
      await sql`
        update fetch_jobs
        set status = ${"failed"},
            finished_at = now(),
            error = ${message},
            updated_at = now()
        where id = ${job.id}
      `;
    }
    return { created: 0, unchanged: 0, failed: 1, errors: [`${source.id}: ${message}`] };
  }
}

export async function runCollectorWorker(args: { workerId?: string; limit?: number } = {}): Promise<{
  claimed: number;
  created: number;
  unchanged: number;
  failed: number;
  errors: string[];
}> {
  const workerId = args.workerId ?? `collector-${process.pid}-${Date.now()}`;
  const jobs = await claimFetchJobs(workerId, args.limit ?? 5);
  let created = 0;
  let unchanged = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    const result = await processFetchJob(workerId, job);
    created += result.created;
    unchanged += result.unchanged;
    failed += result.failed;
    errors.push(...result.errors);
  }

  return { claimed: jobs.length, created, unchanged, failed, errors };
}

export async function runIngestCycle(): Promise<{
  synced: number;
  enqueued: number;
  claimed: number;
  created: number;
  unchanged: number;
  failed: number;
  errors: string[];
}> {
  const schedule = await enqueueDueSourceJobs(100);
  const collect = await runCollectorWorker({ limit: 10 });
  return { ...schedule, ...collect };
}

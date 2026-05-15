import postgres, { type Sql } from "postgres";

declare global {
  var __releaselogSql: Sql | undefined;
  var __releaselogSchemaReady: Promise<boolean> | undefined;
}

function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}

export function getDb(): Sql | null {
  const url = getDatabaseUrl();
  if (!url) {
    return null;
  }
  if (!globalThis.__releaselogSql) {
    globalThis.__releaselogSql = postgres(url, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 15,
      prepare: false,
    });
  }
  return globalThis.__releaselogSql;
}

async function initSchema(sql: Sql): Promise<boolean> {
  await sql.unsafe(`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      stripe_customer_id text unique,
      created_at timestamptz not null default now(),
      last_login_at timestamptz
    );

    create table if not exists magic_link_tokens (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text not null unique,
      redirect_path text,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists sessions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    );

    create table if not exists subscriptions (
      id text primary key,
      user_id text not null unique references users(id) on delete cascade,
      provider text not null default 'stripe',
      provider_customer_id text unique,
      provider_subscription_id text unique,
      status text not null default 'inactive',
      current_period_end timestamptz,
      cancel_at_period_end boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists notification_preferences (
      user_id text primary key references users(id) on delete cascade,
      email_enabled boolean not null default true,
      rss_enabled boolean not null default true,
      selected_entity_ids jsonb not null default '[]'::jsonb,
      last_emailed_release_at timestamptz,
      updated_at timestamptz not null default now()
    );

    create table if not exists private_feed_tokens (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text not null unique,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists source_checkpoints (
      source_id text primary key,
      entity_id text not null,
      url text not null,
      last_fingerprint text,
      last_fetched_at timestamptz,
      last_candidate_id text
    );

    create table if not exists release_sources (
      id text primary key,
      entity_id text not null,
      source_type text not null,
      label text not null,
      url text not null,
      enabled boolean not null default true,
      poll_interval_seconds integer not null default 300,
      priority integer not null default 5,
      config jsonb not null default '{}'::jsonb,
      last_scheduled_at timestamptz,
      next_fetch_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists fetch_jobs (
      id text primary key,
      source_id text not null references release_sources(id) on delete cascade,
      job_type text not null default 'fetch_source',
      status text not null default 'queued',
      priority integer not null default 5,
      run_after timestamptz not null default now(),
      attempts integer not null default 0,
      max_attempts integer not null default 3,
      locked_at timestamptz,
      locked_by text,
      error text,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      finished_at timestamptz
    );

    create table if not exists source_fetch_runs (
      id text primary key,
      source_id text not null references release_sources(id) on delete cascade,
      job_id text references fetch_jobs(id) on delete set null,
      status text not null,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      status_code integer,
      fingerprint text,
      error text,
      metadata jsonb not null default '{}'::jsonb
    );

    create table if not exists ai_review_runs (
      id text primary key,
      provider text not null,
      model text,
      status text not null,
      command text,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      exit_code integer,
      output text,
      error text,
      metadata jsonb not null default '{}'::jsonb
    );

    create table if not exists ai_harness_runs (
      id text primary key,
      provider text not null,
      session_name text,
      intent text not null,
      status text not null,
      ready boolean,
      risk_level text,
      context_path text,
      outbox_path text,
      checks jsonb not null default '[]'::jsonb,
      error text,
      metadata jsonb not null default '{}'::jsonb,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      updated_at timestamptz not null default now()
    );

    create table if not exists ai_harness_events (
      id text primary key,
      run_id text not null,
      provider text,
      session_name text,
      intent text,
      phase text not null,
      level text not null default 'info',
      message text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists published_releases (
      id text primary key,
      entity_id text not null,
      date text not null,
      title text not null,
      short_title text,
      slug text,
      description text,
      what_changed text,
      how_to_steps jsonb not null default '[]'::jsonb,
      how_to_prerequisites jsonb not null default '[]'::jsonb,
      doc_urls jsonb not null default '[]'::jsonb,
      tags jsonb not null default '[]'::jsonb,
      source_url text,
      importance integer not null default 1,
      audience jsonb not null default '[]'::jsonb,
      status text,
      related_ids jsonb not null default '[]'::jsonb,
      source_candidate_id text,
      created_by_user_id text references users(id) on delete set null,
      published_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );

    create table if not exists release_candidates (
      id text primary key,
      entity_id text not null,
      source_id text not null,
      source_label text not null,
      source_url text not null,
      source_fingerprint text not null,
      raw_title text not null,
      raw_body text,
      raw_published_at timestamptz,
      status text not null default 'pending',
      fetched_at timestamptz not null,
      approved_release_id text references published_releases(id) on delete set null,
      rejection_reason text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists release_events (
      id text primary key,
      source_id text not null references release_sources(id) on delete cascade,
      entity_id text not null,
      event_type text not null default 'source_update',
      title text not null,
      body text,
      source_url text not null,
      published_at timestamptz,
      fingerprint text not null,
      confidence numeric(4,3) not null default 0.5,
      raw jsonb not null default '{}'::jsonb,
      candidate_id text references release_candidates(id) on delete set null,
      created_at timestamptz not null default now()
    );

    create table if not exists sent_notifications (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      release_id text not null references published_releases(id) on delete cascade,
      channel text not null,
      status text not null default 'sent',
      error text,
      provider_message_id text,
      created_at timestamptz not null default now(),
      unique (user_id, release_id, channel)
    );

    create index if not exists idx_release_candidates_status on release_candidates(status, created_at desc);
    create index if not exists idx_release_candidates_source on release_candidates(source_id, source_fingerprint);
    create index if not exists idx_release_sources_due on release_sources(enabled, next_fetch_at, priority desc);
    create index if not exists idx_fetch_jobs_claim on fetch_jobs(status, run_after, priority desc, created_at);
    create index if not exists idx_source_fetch_runs_source_started on source_fetch_runs(source_id, started_at desc);
    create index if not exists idx_release_events_entity_created on release_events(entity_id, created_at desc);
    create index if not exists idx_ai_harness_runs_status_started on ai_harness_runs(status, started_at desc);
    create index if not exists idx_ai_harness_events_run_created on ai_harness_events(run_id, created_at desc);
    create index if not exists idx_ai_harness_events_created on ai_harness_events(created_at desc);
    create index if not exists idx_published_releases_entity_date on published_releases(entity_id, date desc);
    create index if not exists idx_private_feed_tokens_user on private_feed_tokens(user_id, revoked_at);
    create index if not exists idx_sessions_user on sessions(user_id, expires_at);

    alter table sent_notifications add column if not exists attempts int not null default 0;
    alter table sent_notifications add column if not exists next_retry_at timestamptz;
    alter table sent_notifications add column if not exists updated_at timestamptz not null default now();
    update sent_notifications set next_retry_at = created_at where next_retry_at is null;

    create index if not exists idx_sent_notifications_retry
      on sent_notifications (next_retry_at)
      where status in ('pending','failed');

    create unique index if not exists uq_published_releases_source_candidate
      on published_releases (source_candidate_id)
      where source_candidate_id is not null;

    create unique index if not exists uq_release_events_source_fingerprint
      on release_events (source_id, fingerprint);

    create table if not exists sent_digests (
      user_id text not null references users(id) on delete cascade,
      period_start date not null,
      channel text not null,
      sent_at timestamptz not null default now(),
      provider_message_id text,
      primary key (user_id, period_start, channel)
    );
    create index if not exists idx_sent_digests_period on sent_digests (period_start);
  `);
  return true;
}

export async function ensureDb(): Promise<Sql | null> {
  const sql = getDb();
  if (!sql) {
    return null;
  }
  if (!globalThis.__releaselogSchemaReady) {
    globalThis.__releaselogSchemaReady = initSchema(sql);
  }
  await globalThis.__releaselogSchemaReady;
  return sql;
}

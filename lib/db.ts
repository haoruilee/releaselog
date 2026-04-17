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
    create index if not exists idx_published_releases_entity_date on published_releases(entity_id, date desc);
    create index if not exists idx_private_feed_tokens_user on private_feed_tokens(user_id, revoked_at);
    create index if not exists idx_sessions_user on sessions(user_id, expires_at);
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

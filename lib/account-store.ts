import { randomUUID } from "node:crypto";
import type { EntityMeta } from "@/data";
import { entityMetas } from "@/data";
import { ensureDb } from "@/lib/db";
import { buildPrivateFeedToken, normalizeEmail, parsePrivateFeedToken, sha256 } from "@/lib/security";

export type UserRecord = {
  id: string;
  email: string;
  stripeCustomerId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
};

export type SubscriptionRecord = {
  id: string;
  userId: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferenceRecord = {
  userId: string;
  emailEnabled: boolean;
  rssEnabled: boolean;
  selectedEntityIds: string[];
  lastEmailedReleaseAt: string | null;
  updatedAt: string;
};

export type PrivateFeedTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  revokedAt: string | null;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: Date;
  last_login_at: Date | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  last_seen_at: Date;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
};

type PreferenceRow = {
  user_id: string;
  email_enabled: boolean;
  rss_enabled: boolean;
  selected_entity_ids: unknown;
  last_emailed_release_at: Date | null;
  updated_at: Date;
};

type FeedTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  revoked_at: Date | null;
  created_at: Date;
};

function defaultEntityIds(): string[] {
  return entityMetas.map((entity: EntityMeta) => entity.id);
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    stripeCustomerId: row.stripe_customer_id,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  };
}

function mapSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function mapPreferences(row: PreferenceRow): NotificationPreferenceRecord {
  return {
    userId: row.user_id,
    emailEnabled: row.email_enabled,
    rssEnabled: row.rss_enabled,
    selectedEntityIds: asStringArray(row.selected_entity_ids),
    lastEmailedReleaseAt: row.last_emailed_release_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapFeedToken(row: FeedTokenRow): PrivateFeedTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function isDatabaseConfigured(): Promise<boolean> {
  return (await ensureDb()) !== null;
}

export async function upsertUserByEmail(emailInput: string): Promise<UserRecord> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const email = normalizeEmail(emailInput);
  const rows = await sql<UserRow[]>`
    insert into users (id, email)
    values (${randomUUID()}, ${email})
    on conflict (email) do update set email = excluded.email
    returning id, email, stripe_customer_id, created_at, last_login_at
  `;
  return mapUser(rows[0]!);
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<UserRow[]>`
    select id, email, stripe_customer_id, created_at, last_login_at
    from users
    where id = ${userId}
    limit 1
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByEmail(emailInput: string): Promise<UserRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const email = normalizeEmail(emailInput);
  const rows = await sql<UserRow[]>`
    select id, email, stripe_customer_id, created_at, last_login_at
    from users
    where email = ${email}
    limit 1
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<UserRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<UserRow[]>`
    select id, email, stripe_customer_id, created_at, last_login_at
    from users
    where stripe_customer_id = ${customerId}
    limit 1
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function updateUserStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  await sql`
    update users
    set stripe_customer_id = ${customerId}
    where id = ${userId}
  `;
}

export async function createMagicLinkToken(userId: string, rawToken: string, redirectPath?: string | null): Promise<void> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  await sql`
    insert into magic_link_tokens (id, user_id, token_hash, redirect_path, expires_at)
    values (${randomUUID()}, ${userId}, ${sha256(rawToken)}, ${redirectPath ?? null}, ${expiresAt.toISOString()})
  `;
}

export async function consumeMagicLinkToken(rawToken: string): Promise<{ user: UserRecord; redirectPath: string | null } | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const tokenHash = sha256(rawToken);
  const rows = await sql<Array<UserRow & { redirect_path: string | null; token_id: string }>>`
    select m.id as token_id, m.redirect_path, u.id, u.email, u.stripe_customer_id, u.created_at, u.last_login_at
    from magic_link_tokens m
    join users u on u.id = m.user_id
    where m.token_hash = ${tokenHash}
      and m.used_at is null
      and m.expires_at > now()
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }
  await sql.begin(async (tx) => {
    await tx`
      update magic_link_tokens
      set used_at = now()
      where id = ${row.token_id}
    `;
    await tx`
      update users
      set last_login_at = now()
      where id = ${row.id}
    `;
  });
  return {
    user: mapUser(row),
    redirectPath: row.redirect_path,
  };
}

export async function createSession(userId: string, rawToken: string): Promise<SessionRecord> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const rows = await sql<SessionRow[]>`
    insert into sessions (id, user_id, token_hash, expires_at)
    values (${randomUUID()}, ${userId}, ${sha256(rawToken)}, ${expiresAt.toISOString()})
    returning id, user_id, token_hash, expires_at, created_at, last_seen_at
  `;
  return mapSession(rows[0]!);
}

export async function deleteSession(rawToken: string): Promise<void> {
  const sql = await ensureDb();
  if (!sql) return;
  await sql`
    delete from sessions
    where token_hash = ${sha256(rawToken)}
  `;
}

export async function getUserFromSessionToken(rawToken: string): Promise<UserRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const tokenHash = sha256(rawToken);
  const rows = await sql<UserRow[]>`
    select u.id, u.email, u.stripe_customer_id, u.created_at, u.last_login_at
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.expires_at > now()
    limit 1
  `;
  if (!rows[0]) {
    return null;
  }
  await sql`
    update sessions
    set last_seen_at = now()
    where token_hash = ${tokenHash}
  `;
  return mapUser(rows[0]);
}

export async function getSubscriptionForUser(userId: string): Promise<SubscriptionRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<SubscriptionRow[]>`
    select id, user_id, provider, provider_customer_id, provider_subscription_id, status,
           current_period_end, cancel_at_period_end, created_at, updated_at
    from subscriptions
    where user_id = ${userId}
    limit 1
  `;
  return rows[0] ? mapSubscription(rows[0]) : null;
}

export async function getSubscriptionByProviderSubscriptionId(subscriptionId: string): Promise<SubscriptionRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<SubscriptionRow[]>`
    select id, user_id, provider, provider_customer_id, provider_subscription_id, status,
           current_period_end, cancel_at_period_end, created_at, updated_at
    from subscriptions
    where provider_subscription_id = ${subscriptionId}
    limit 1
  `;
  return rows[0] ? mapSubscription(rows[0]) : null;
}

export async function upsertSubscription(args: {
  userId: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<SubscriptionRecord> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const rows = await sql<SubscriptionRow[]>`
    insert into subscriptions (
      id,
      user_id,
      provider,
      provider_customer_id,
      provider_subscription_id,
      status,
      current_period_end,
      cancel_at_period_end,
      updated_at
    )
    values (
      ${randomUUID()},
      ${args.userId},
      ${"stripe"},
      ${args.providerCustomerId ?? null},
      ${args.providerSubscriptionId ?? null},
      ${args.status},
      ${args.currentPeriodEnd ?? null},
      ${args.cancelAtPeriodEnd ?? false},
      now()
    )
    on conflict (user_id) do update
    set provider_customer_id = coalesce(excluded.provider_customer_id, subscriptions.provider_customer_id),
        provider_subscription_id = coalesce(excluded.provider_subscription_id, subscriptions.provider_subscription_id),
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        updated_at = now()
    returning id, user_id, provider, provider_customer_id, provider_subscription_id, status,
              current_period_end, cancel_at_period_end, created_at, updated_at
  `;
  return mapSubscription(rows[0]!);
}

export async function ensureNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const defaults = defaultEntityIds();
  const rows = await sql<PreferenceRow[]>`
    insert into notification_preferences (user_id, selected_entity_ids)
    values (${userId}, ${JSON.stringify(defaults)}::jsonb)
    on conflict (user_id) do update set user_id = excluded.user_id
    returning user_id, email_enabled, rss_enabled, selected_entity_ids, last_emailed_release_at, updated_at
  `;
  return mapPreferences(rows[0]!);
}

export async function updateNotificationPreferences(args: {
  userId: string;
  emailEnabled: boolean;
  rssEnabled: boolean;
  selectedEntityIds: string[];
}): Promise<NotificationPreferenceRecord> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const rows = await sql<PreferenceRow[]>`
    insert into notification_preferences (
      user_id,
      email_enabled,
      rss_enabled,
      selected_entity_ids,
      updated_at
    )
    values (
      ${args.userId},
      ${args.emailEnabled},
      ${args.rssEnabled},
      ${JSON.stringify(args.selectedEntityIds)}::jsonb,
      now()
    )
    on conflict (user_id) do update
    set email_enabled = excluded.email_enabled,
        rss_enabled = excluded.rss_enabled,
        selected_entity_ids = excluded.selected_entity_ids,
        updated_at = now()
    returning user_id, email_enabled, rss_enabled, selected_entity_ids, last_emailed_release_at, updated_at
  `;
  return mapPreferences(rows[0]!);
}

export async function rotatePrivateFeedToken(userId: string): Promise<string> {
  const sql = await ensureDb();
  if (!sql) {
    throw new Error("db_unconfigured");
  }
  const tokenId = randomUUID();
  const rawToken = buildPrivateFeedToken(tokenId);
  const tokenHash = sha256(rawToken);
  await sql.begin(async (tx) => {
    await tx`
      update private_feed_tokens
      set revoked_at = now()
      where user_id = ${userId}
        and revoked_at is null
    `;
    await tx`
      insert into private_feed_tokens (id, user_id, token_hash)
      values (${tokenId}, ${userId}, ${tokenHash})
    `;
  });
  return rawToken;
}

export async function getActivePrivateFeedToken(userId: string): Promise<PrivateFeedTokenRecord | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const rows = await sql<FeedTokenRow[]>`
    select id, user_id, token_hash, revoked_at, created_at
    from private_feed_tokens
    where user_id = ${userId}
      and revoked_at is null
    order by created_at desc
    limit 1
  `;
  return rows[0] ? mapFeedToken(rows[0]) : null;
}

export async function resolvePrivateFeedAccess(rawToken: string): Promise<{
  user: UserRecord;
  subscription: SubscriptionRecord | null;
  preferences: NotificationPreferenceRecord | null;
} | null> {
  const sql = await ensureDb();
  if (!sql) return null;
  const tokenId = parsePrivateFeedToken(rawToken);
  if (!tokenId) {
    return null;
  }
  const tokenHash = sha256(rawToken);
  const rows = await sql<Array<
    UserRow &
    {
      sub_id: string | null;
      sub_provider: string | null;
      sub_provider_customer_id: string | null;
      sub_provider_subscription_id: string | null;
      sub_status: string | null;
      sub_current_period_end: Date | null;
      sub_cancel_at_period_end: boolean | null;
      sub_created_at: Date | null;
      sub_updated_at: Date | null;
      pref_user_id: string | null;
      pref_email_enabled: boolean | null;
      pref_rss_enabled: boolean | null;
      pref_selected_entity_ids: unknown;
      pref_last_emailed_release_at: Date | null;
      pref_updated_at: Date | null;
    }
  >>`
    select
      u.id,
      u.email,
      u.stripe_customer_id,
      u.created_at,
      u.last_login_at,
      s.id as sub_id,
      s.provider as sub_provider,
      s.provider_customer_id as sub_provider_customer_id,
      s.provider_subscription_id as sub_provider_subscription_id,
      s.status as sub_status,
      s.current_period_end as sub_current_period_end,
      s.cancel_at_period_end as sub_cancel_at_period_end,
      s.created_at as sub_created_at,
      s.updated_at as sub_updated_at,
      p.user_id as pref_user_id,
      p.email_enabled as pref_email_enabled,
      p.rss_enabled as pref_rss_enabled,
      p.selected_entity_ids as pref_selected_entity_ids,
      p.last_emailed_release_at as pref_last_emailed_release_at,
      p.updated_at as pref_updated_at
    from private_feed_tokens t
    join users u on u.id = t.user_id
    left join subscriptions s on s.user_id = u.id
    left join notification_preferences p on p.user_id = u.id
    where t.id = ${tokenId}
      and t.token_hash = ${tokenHash}
      and t.revoked_at is null
    order by t.created_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    user: mapUser(row),
    subscription: row.sub_id
      ? mapSubscription({
          id: row.sub_id,
          user_id: row.id,
          provider: row.sub_provider ?? "stripe",
          provider_customer_id: row.sub_provider_customer_id,
          provider_subscription_id: row.sub_provider_subscription_id,
          status: row.sub_status ?? "inactive",
          current_period_end: row.sub_current_period_end,
          cancel_at_period_end: row.sub_cancel_at_period_end ?? false,
          created_at: row.sub_created_at ?? new Date(),
          updated_at: row.sub_updated_at ?? new Date(),
        })
      : null,
    preferences: row.pref_user_id
      ? mapPreferences({
          user_id: row.pref_user_id,
          email_enabled: row.pref_email_enabled ?? true,
          rss_enabled: row.pref_rss_enabled ?? true,
          selected_entity_ids: row.pref_selected_entity_ids,
          last_emailed_release_at: row.pref_last_emailed_release_at,
          updated_at: row.pref_updated_at ?? new Date(),
        })
      : null,
  };
}

export async function listActiveSubscribers(): Promise<Array<{
  user: UserRecord;
  subscription: SubscriptionRecord;
  preferences: NotificationPreferenceRecord;
}>> {
  const sql = await ensureDb();
  if (!sql) return [];
  const rows = await sql<Array<
    UserRow &
    {
      sub_id: string;
      sub_user_id: string;
      sub_provider: string;
      sub_provider_customer_id: string | null;
      sub_provider_subscription_id: string | null;
      sub_status: string;
      sub_current_period_end: Date | null;
      sub_cancel_at_period_end: boolean;
      sub_created_at: Date;
      sub_updated_at: Date;
      pref_email_enabled: boolean;
      pref_rss_enabled: boolean;
      pref_selected_entity_ids: unknown;
      pref_last_emailed_release_at: Date | null;
      pref_updated_at: Date;
    }
  >>`
    select
      u.id,
      u.email,
      u.stripe_customer_id,
      u.created_at,
      u.last_login_at,
      s.id as sub_id,
      s.user_id as sub_user_id,
      s.provider as sub_provider,
      s.provider_customer_id as sub_provider_customer_id,
      s.provider_subscription_id as sub_provider_subscription_id,
      s.status as sub_status,
      s.current_period_end as sub_current_period_end,
      s.cancel_at_period_end as sub_cancel_at_period_end,
      s.created_at as sub_created_at,
      s.updated_at as sub_updated_at,
      p.email_enabled as pref_email_enabled,
      p.rss_enabled as pref_rss_enabled,
      p.selected_entity_ids as pref_selected_entity_ids,
      p.last_emailed_release_at as pref_last_emailed_release_at,
      p.updated_at as pref_updated_at
    from users u
    join subscriptions s on s.user_id = u.id
    join notification_preferences p on p.user_id = u.id
    order by u.created_at desc
  `;
  return rows.map((row) => ({
    user: mapUser(row),
    subscription: mapSubscription({
      id: row.sub_id,
      user_id: row.sub_user_id,
      provider: row.sub_provider,
      provider_customer_id: row.sub_provider_customer_id,
      provider_subscription_id: row.sub_provider_subscription_id,
      status: row.sub_status,
      current_period_end: row.sub_current_period_end,
      cancel_at_period_end: row.sub_cancel_at_period_end,
      created_at: row.sub_created_at,
      updated_at: row.sub_updated_at,
    }),
    preferences: mapPreferences({
      user_id: row.id,
      email_enabled: row.pref_email_enabled,
      rss_enabled: row.pref_rss_enabled,
      selected_entity_ids: row.pref_selected_entity_ids,
      last_emailed_release_at: row.pref_last_emailed_release_at,
      updated_at: row.pref_updated_at,
    }),
  }));
}

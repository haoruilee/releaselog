#!/usr/bin/env node
import readline from "node:readline";

const SERVER_NAME = "releaselog-trends";
const SERVER_VERSION = "0.1.1";
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";
const API_BASE = normalizeBaseUrl(process.env.RELEASELOG_API_BASE || "https://releaselog.site");

const AUDIENCES = ["end_user", "developer", "admin", "partner"];
const STATUSES = ["stable", "preview", "beta", "deprecated"];
const KINDS = ["release", "event"];
const TRENDING_THEME_RULES = [
  {
    name: "Developer events and conferences",
    priority: 1,
    match: (item) =>
      releaseKind(item) === "event" ||
      item.entityId === "ai-events" ||
      hasAnyTag(item, ["developer-conference", "google-io", "sessions", "founders"])
  },
  {
    name: "Coding agents and developer tooling",
    priority: 2,
    match: (item) =>
      hasAnyTag(item, ["claude-code", "codex", "developer-experience", "tests"]) ||
      textIncludesAny(item, ["codex", "grok build", "opencode", "code with claude", "coding agent", "terminal-based coding"])
  },
  {
    name: "Enterprise governance and admin controls",
    priority: 3,
    match: (item) =>
      hasAnyTag(item, ["enterprise", "governance", "security", "compliance", "admin"]) ||
      asArray(item.audience).includes("admin") ||
      textIncludesAny(item, ["compliance", "govern", "security", "enterprise"])
  },
  {
    name: "Models, multimodal, and inference",
    priority: 4,
    match: (item) =>
      hasAnyTag(item, ["model", "multimodal", "vision", "api", "inference", "patch"]) ||
      textIncludesAny(item, ["model", "gemini", "deepseek", "mistral", "voxtral", "vllm", "multimodal", "vision"])
  },
  {
    name: "Research, science, and industrial AI",
    priority: 5,
    match: (item) =>
      hasAnyTag(item, ["research", "science", "industrial"]) ||
      textIncludesAny(item, ["research", "science", "industrial", "physics", "geometry", "manufacturing"])
  }
];

const tools = [
  {
    name: "release_log_list_sources",
    description: "List AI teams, products, and event sources tracked by ReleaseLog.",
    annotations: readOnlyAnnotations(),
    outputSchema: objectOutputSchema(),
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    handler: listSources
  },
  {
    name: "release_log_trending_now",
    description: "One-call user-facing snapshot for questions like 'what AI releases are trending this week?' Returns deduped themes, concise brief, notable launches, events, and source URLs.",
    annotations: readOnlyAnnotations(),
    outputSchema: objectOutputSchema(),
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "Lookback window in days. Defaults to 7 for 'this week' style questions."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "Maximum raw items to analyze. Defaults to 200."
        },
        entity: {
          type: "string",
          description: "Optional entity id to summarize one team/product."
        },
        tag: {
          type: "string",
          description: "Optional release tag filter."
        },
        audience: {
          type: "string",
          enum: AUDIENCES
        },
        status: {
          type: "string",
          enum: STATUSES
        },
        kind: {
          type: "string",
          enum: KINDS,
          description: "Client-side filter for release or event entries."
        },
        dedupe: {
          type: "boolean",
          description: "Merge duplicated or mirrored entries before summarizing. Defaults to true."
        }
      },
      additionalProperties: false
    },
    handler: trendingNow
  },
  {
    name: "release_log_latest_releases",
    description: "Fetch the latest AI releases and events across ReleaseLog, optionally filtered by entity, tag, audience, status, or kind.",
    annotations: readOnlyAnnotations(),
    outputSchema: objectOutputSchema(),
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "Lookback window in days. Defaults to 30."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "Maximum items to return. Defaults to 50."
        },
        offset: {
          type: "integer",
          minimum: 0,
          description: "Pagination offset. Defaults to 0."
        },
        entity: {
          type: "string",
          description: "Optional entity id, such as openai-team, anthropic-team, claude-product, or ai-events."
        },
        tag: {
          type: "string",
          description: "Optional release tag filter."
        },
        audience: {
          type: "string",
          enum: AUDIENCES
        },
        status: {
          type: "string",
          enum: STATUSES
        },
        kind: {
          type: "string",
          enum: KINDS,
          description: "Client-side filter for release or event entries."
        },
        includeDescription: {
          type: "boolean",
          description: "Include long description text. Defaults to false."
        },
        dedupe: {
          type: "boolean",
          description: "Merge duplicated or mirrored entries before pagination. Defaults to false for raw feed use."
        }
      },
      additionalProperties: false
    },
    handler: latestReleases
  },
  {
    name: "release_log_source_releases",
    description: "Fetch releases for a specific ReleaseLog entity id, with optional date and metadata filters.",
    annotations: readOnlyAnnotations(),
    outputSchema: objectOutputSchema(),
    inputSchema: {
      type: "object",
      required: ["entityId"],
      properties: {
        entityId: {
          type: "string",
          description: "ReleaseLog entity id, such as openai-team or anthropic-team."
        },
        from: {
          type: "string",
          description: "Start date in YYYY-MM-DD format."
        },
        to: {
          type: "string",
          description: "End date in YYYY-MM-DD format."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "Maximum items to return. Defaults to 100."
        },
        offset: {
          type: "integer",
          minimum: 0,
          description: "Pagination offset. Defaults to 0."
        },
        tag: {
          type: "string"
        },
        audience: {
          type: "string",
          enum: AUDIENCES
        },
        status: {
          type: "string",
          enum: STATUSES
        },
        kind: {
          type: "string",
          enum: KINDS,
          description: "Client-side filter for release or event entries."
        },
        includeDescription: {
          type: "boolean",
          description: "Include long description text. Defaults to false."
        },
        dedupe: {
          type: "boolean",
          description: "Merge duplicated or mirrored entries before pagination. Defaults to false for raw timeline use."
        }
      },
      additionalProperties: false
    },
    handler: sourceReleases
  },
  {
    name: "release_log_trends",
    description: "Summarize recent AI release trends with counts by source, tags, status, audience, kind, and week plus notable releases.",
    annotations: readOnlyAnnotations(),
    outputSchema: objectOutputSchema(),
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "Lookback window in days. Defaults to 30."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "Maximum raw items to analyze. Defaults to 200."
        },
        entity: {
          type: "string",
          description: "Optional entity id to summarize one team/product."
        },
        tag: {
          type: "string",
          description: "Optional release tag filter."
        },
        audience: {
          type: "string",
          enum: AUDIENCES
        },
        status: {
          type: "string",
          enum: STATUSES
        },
        kind: {
          type: "string",
          enum: KINDS,
          description: "Client-side filter for release or event entries."
        },
        dedupe: {
          type: "boolean",
          description: "Merge duplicated or mirrored entries before summarizing. Defaults to true."
        }
      },
      additionalProperties: false
    },
    handler: trendSummary
  },
  {
    name: "release_log_source_detail",
    description: "Fetch metadata for one ReleaseLog source, optionally including a compact release list.",
    annotations: readOnlyAnnotations(),
    outputSchema: objectOutputSchema(),
    inputSchema: {
      type: "object",
      required: ["entityId"],
      properties: {
        entityId: {
          type: "string",
          description: "ReleaseLog entity id."
        },
        includeReleases: {
          type: "boolean",
          description: "Include compact release items. Defaults to false."
        },
        releaseLimit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "When includeReleases is true, cap release items. Defaults to 50."
        },
        includeDescription: {
          type: "boolean",
          description: "Include long description text. Defaults to false."
        }
      },
      additionalProperties: false
    },
    handler: sourceDetail
  }
];

const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

async function listSources() {
  const data = await fetchJson("/api/v1/entity-list");
  return {
    source: "ReleaseLog",
    apiBase: API_BASE,
    apiPath: "/api/v1/entity-list",
    schemaVersion: data.schemaVersion,
    entities: (data.entities || []).map(compactEntity)
  };
}

async function latestReleases(args) {
  const includeDescription = booleanArg(args, "includeDescription", false);
  const requestedLimit = intArg(args, "limit", 50, 1, 500);
  const requestedOffset = intArg(args, "offset", 0, 0, 100000);
  const kind = enumArg(args, "kind", KINDS);
  const dedupe = booleanArg(args, "dedupe", false);
  const query = recentQuery(args, {
    defaultLimit: kind || dedupe ? 500 : requestedLimit,
    defaultOffset: kind || dedupe ? 0 : requestedOffset
  });

  const data = await fetchJson("/api/v1/releases/recent", query);
  let releases = (data.releases || []).filter((item) => !kind || releaseKind(item) === kind);
  const dedupeResult = dedupeReleases(releases.map((item) => compactRelease(item, true)));
  if (dedupe) {
    releases = dedupeResult.items;
  }
  if (kind || dedupe) {
    releases = releases.slice(requestedOffset, requestedOffset + requestedLimit);
  }

  return {
    source: "ReleaseLog",
    apiBase: API_BASE,
    apiPath: "/api/v1/releases/recent",
    schemaVersion: data.schemaVersion,
    range: {
      from: data.from,
      to: data.to,
      days: data.days
    },
    query: {
      ...query,
      kind,
      dedupe,
      requestedLimit,
      requestedOffset
    },
    total: data.total,
    returned: releases.length,
    dedupe: buildDedupeMeta(dedupe, dedupeResult),
    releases: releases.map((item) => compactRelease(item, includeDescription))
  };
}

async function sourceReleases(args) {
  const entityId = requiredString(args, "entityId");
  const includeDescription = booleanArg(args, "includeDescription", false);
  const requestedLimit = intArg(args, "limit", 100, 1, 500);
  const requestedOffset = intArg(args, "offset", 0, 0, 100000);
  const kind = enumArg(args, "kind", KINDS);
  const dedupe = booleanArg(args, "dedupe", false);
  const query = releaseQuery(args, {
    defaultLimit: kind || dedupe ? 500 : requestedLimit,
    defaultOffset: kind || dedupe ? 0 : requestedOffset
  });

  const data = await fetchJson(`/api/v1/entity-releases/${encodeURIComponent(entityId)}`, query);
  let releases = (data.releases || []).filter((item) => !kind || releaseKind(item) === kind);
  const dedupeResult = dedupeReleases(releases.map((item) => compactRelease(item, true)));
  if (dedupe) {
    releases = dedupeResult.items;
  }
  if (kind || dedupe) {
    releases = releases.slice(requestedOffset, requestedOffset + requestedLimit);
  }

  return {
    source: "ReleaseLog",
    apiBase: API_BASE,
    apiPath: `/api/v1/entity-releases/${entityId}`,
    schemaVersion: data.schemaVersion,
    entityId: data.entityId,
    query: {
      ...query,
      kind,
      dedupe,
      requestedLimit,
      requestedOffset
    },
    returned: releases.length,
    dedupe: buildDedupeMeta(dedupe, dedupeResult),
    releases: releases.map((item) => compactRelease(item, includeDescription))
  };
}

async function trendingNow(args) {
  return trendSummary({
    ...args,
    days: intArg(args, "days", 7, 1, 365),
    dedupe: booleanArg(args, "dedupe", true)
  });
}

async function trendSummary(args) {
  const requestedLimit = intArg(args, "limit", 200, 1, 500);
  const kind = enumArg(args, "kind", KINDS);
  const dedupe = booleanArg(args, "dedupe", true);
  const query = recentQuery(args, { defaultLimit: requestedLimit, defaultOffset: 0 });
  const data = await fetchJson("/api/v1/releases/recent", query);
  const rawReleases = (data.releases || [])
    .filter((item) => !kind || releaseKind(item) === kind)
    .map((item) => compactRelease(item, false));
  const dedupeResult = dedupeReleases(rawReleases);
  const releases = dedupe ? dedupeResult.items : rawReleases;

  const entityCounts = topCounts(countBy(releases, (item) => item.entityName || item.entityId || "unknown"), 10);
  const tagCounts = topCounts(countMany(releases, (item) => item.tags || []), 15);
  const statusCounts = topCounts(countBy(releases, (item) => item.status || "unspecified"), 10);
  const audienceCounts = topCounts(countMany(releases, (item) => asArray(item.audience).length ? asArray(item.audience) : ["unspecified"]), 10);
  const kindCounts = topCounts(countBy(releases, (item) => item.kind || "release"), 10);
  const weekCounts = topCounts(countBy(releases, (item) => weekStart(item.date)), 20);
  const eventCount = releases.filter((item) => item.kind === "event").length;
  const releaseCount = releases.length - eventCount;
  const topThemes = buildTopThemes(releases, 5);
  const notableItems = [...releases]
    .sort(compareByImportanceThenDate)
    .slice(0, 12);
  const brief = buildTrendBrief({
    range: { from: data.from, to: data.to, days: data.days },
    releases,
    releaseCount,
    eventCount,
    entityCounts,
    tagCounts,
    topThemes,
    dedupeResult,
    dedupeEnabled: dedupe
  });

  return {
    source: "ReleaseLog",
    apiBase: API_BASE,
    apiPath: "/api/v1/releases/recent",
    schemaVersion: data.schemaVersion,
    range: {
      from: data.from,
      to: data.to,
      days: data.days
    },
    filters: {
      entity: query.entity,
      tag: query.tag,
      audience: query.audience,
      status: query.status,
      kind
    },
    totals: {
      apiTotal: data.total,
      rawAnalyzed: rawReleases.length,
      analyzed: releases.length,
      releases: releaseCount,
      events: eventCount
    },
    dedupe: buildDedupeMeta(dedupe, dedupeResult),
    leaders: {
      entities: entityCounts,
      tags: tagCounts,
      statuses: statusCounts,
      audiences: audienceCounts,
      kinds: kindCounts,
      weeks: weekCounts
    },
    topThemes,
    brief,
    trendLines: buildTrendLines({ entityCounts, tagCounts, audienceCounts, releaseCount, eventCount, topThemes, dedupeResult, dedupeEnabled: dedupe }),
    notableItems,
    latestItems: releases.slice(0, 12)
  };
}

async function sourceDetail(args) {
  const entityId = requiredString(args, "entityId");
  const includeReleases = booleanArg(args, "includeReleases", false);
  const includeDescription = booleanArg(args, "includeDescription", false);
  const releaseLimit = intArg(args, "releaseLimit", 50, 1, 500);
  const data = await fetchJson(`/api/v1/entities/${encodeURIComponent(entityId)}`);
  const { releases = [], ...entity } = data.entity || {};

  return {
    source: "ReleaseLog",
    apiBase: API_BASE,
    apiPath: `/api/v1/entities/${entityId}`,
    schemaVersion: data.schemaVersion,
    entity: compactEntity(entity),
    releases: includeReleases
      ? releases.slice(0, releaseLimit).map((item) => compactRelease(item, includeDescription))
      : undefined
  };
}

function recentQuery(args, options) {
  return dropUndefined({
    days: intArg(args, "days", 30, 1, 365),
    limit: options.defaultLimit,
    offset: options.defaultOffset,
    entity: stringArg(args, "entity"),
    tag: stringArg(args, "tag"),
    audience: enumArg(args, "audience", AUDIENCES),
    status: enumArg(args, "status", STATUSES)
  });
}

function releaseQuery(args, options) {
  return dropUndefined({
    from: dateArg(args, "from"),
    to: dateArg(args, "to"),
    limit: options.defaultLimit,
    offset: options.defaultOffset,
    tag: stringArg(args, "tag"),
    audience: enumArg(args, "audience", AUDIENCES),
    status: enumArg(args, "status", STATUSES)
  });
}

async function fetchJson(path, query = {}) {
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required because this MCP server uses global fetch().");
  }

  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": `${SERVER_NAME}/${SERVER_VERSION}`
      },
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ReleaseLog API returned ${response.status} for ${url.pathname}: ${text.slice(0, 500)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function compactEntity(entity) {
  return dropUndefined({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    headline: entity.headline,
    subtitle: entity.subtitle,
    footnote: entity.footnote,
    brandLine: entity.brandLine,
    brandUrl: entity.brandUrl,
    releaseCount: entity.releaseCount,
    eventCount: entity.eventCount,
    logCount: entity.logCount,
    members: entity.members
  });
}

function compactRelease(item, includeDescription) {
  return dropUndefined({
    id: item.id,
    date: item.date,
    title: item.title,
    shortTitle: item.shortTitle,
    slug: item.slug,
    kind: releaseKind(item),
    entityId: item.entityId,
    entityName: item.entityName,
    whatChanged: item.whatChanged,
    description: includeDescription ? item.description : undefined,
    howTo: item.howTo,
    tags: item.tags,
    sourceUrl: item.sourceUrl,
    docUrls: item.docUrls,
    importance: item.importance,
    audience: item.audience,
    status: item.status,
    relatedIds: item.relatedIds
  });
}

function buildTrendLines(summary) {
  const lines = [];
  if (summary.topThemes[0]) {
    lines.push(`Main theme: ${summary.topThemes[0].name} (${formatItemCount(summary.topThemes[0].count)}).`);
  }
  if (summary.entityCounts[0]) {
    lines.push(`Most active source: ${summary.entityCounts[0].name} (${formatItemCount(summary.entityCounts[0].count)}).`);
  }
  const usefulTag = summary.tagCounts.find((entry) => !["event", "unspecified"].includes(entry.name));
  if (usefulTag) {
    lines.push(`Most useful tag signal: ${usefulTag.name} (${formatItemCount(usefulTag.count)}).`);
  }
  const usefulAudience = summary.audienceCounts.find((entry) => entry.name !== "unspecified");
  if (usefulAudience) {
    lines.push(`Strongest explicit audience signal: ${usefulAudience.name} (${formatItemCount(usefulAudience.count)}).`);
  }
  if (summary.dedupeEnabled && summary.dedupeResult.duplicatesRemoved > 0) {
    lines.push(`Merged ${summary.dedupeResult.duplicatesRemoved} duplicated or mirrored entries before summarizing.`);
  }
  lines.push(`${summary.releaseCount} release entries and ${summary.eventCount} event entries were analyzed after dedupe.`);
  return lines;
}

function buildTrendBrief(summary) {
  const notableLaunches = selectNotableItems(summary.releases, {
    kind: "release",
    limit: 6,
    excludeEntityIds: []
  });
  const notableEvents = selectNotableItems(summary.releases, {
    kind: "event",
    limit: 4,
    excludeEntityIds: []
  });
  const topSources = summary.entityCounts.slice(0, 4).map(formatCount).join(", ");
  const topTags = summary.tagCounts
    .filter((entry) => !["event", "unspecified"].includes(entry.name))
    .slice(0, 4)
    .map(formatCount)
    .join(", ");
  const summaryLines = [
    `Range: ${summary.range.from} to ${summary.range.to} (${summary.range.days} days).`,
    `Tracked ${summary.releases.length} unique items: ${summary.releaseCount} releases and ${summary.eventCount} events.`,
    topSources ? `Most active sources: ${topSources}.` : undefined,
    topTags ? `Useful tag signals: ${topTags}.` : undefined,
    summary.dedupeEnabled && summary.dedupeResult.duplicatesRemoved > 0
      ? `Dedupe removed ${summary.dedupeResult.duplicatesRemoved} repeated or mirrored entries from trend counts.`
      : undefined
  ].filter(Boolean);

  return {
    headline: buildHeadline(summary.topThemes, summary.releaseCount, summary.eventCount),
    range: summary.range,
    summary: summaryLines,
    topThemes: summary.topThemes.map((theme) => ({
      name: theme.name,
      count: theme.count
    })),
    notableLaunches,
    notableEvents,
    suggestedAnswerBullets: [
      summary.topThemes[0] ? `Main trend: ${summary.topThemes[0].name}.` : undefined,
      notableLaunches[0] ? `Notable launch: ${notableLaunches[0].title} (${notableLaunches[0].entityName}, ${notableLaunches[0].date}).` : undefined,
      notableEvents[0] ? `Event signal: ${notableEvents[0].title} (${notableEvents[0].date}).` : undefined,
      summary.dedupeEnabled && summary.dedupeResult.duplicatesRemoved > 0
        ? `${summary.dedupeResult.duplicatesRemoved} duplicate/mirrored entries were merged, so counts reflect unique stories.`
        : undefined
    ].filter(Boolean)
  };
}

function buildHeadline(topThemes, releaseCount, eventCount) {
  if (topThemes[0]) {
    return `${topThemes[0].name} led recent AI release activity.`;
  }
  if (releaseCount || eventCount) {
    return `${releaseCount} releases and ${eventCount} events were tracked.`;
  }
  return "No matching ReleaseLog items were found for this range.";
}

function buildTopThemes(items, limit) {
  return TRENDING_THEME_RULES
    .map((rule) => {
      const matches = items.filter(rule.match);
      return {
        name: rule.name,
        count: matches.length,
        sampleItems: selectNotableItems(matches, { limit: 3 })
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || themePriority(a.name) - themePriority(b.name) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function themePriority(name) {
  return TRENDING_THEME_RULES.find((rule) => rule.name === name)?.priority || 100;
}

function selectNotableItems(items, options = {}) {
  const kind = options.kind;
  const limit = options.limit || 5;
  const excludeEntityIds = new Set(options.excludeEntityIds || []);
  return [...items]
    .filter((item) => (!kind || releaseKind(item) === kind) && !excludeEntityIds.has(item.entityId))
    .sort(compareByImportanceThenDate)
    .slice(0, limit)
    .map((item) => dropUndefined({
      id: item.id,
      date: item.date,
      title: item.shortTitle || item.title,
      fullTitle: item.title,
      kind: releaseKind(item),
      entityId: item.entityId,
      entityName: item.entityName,
      whatChanged: item.whatChanged,
      sourceUrl: item.sourceUrl,
      importance: item.importance,
      status: item.status,
      audience: item.audience,
      tags: item.tags
    }));
}

function dedupeReleases(items) {
  const groups = new Map();
  items.forEach((item, index) => {
    const key = duplicateKey(item) || `unique:${item.id || index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const deduped = [];
  const duplicateGroups = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => representativeScore(b) - representativeScore(a) || compareByImportanceThenDate(a, b));
    const representative = sorted[0];
    deduped.push(representative);
    if (group.length > 1) {
      duplicateGroups.push({
        keptId: representative.id,
        title: representative.shortTitle || representative.title,
        count: group.length,
        dates: [...new Set(group.map((item) => item.date).filter(Boolean))].sort(),
        entities: [...new Set(group.map((item) => item.entityName || item.entityId).filter(Boolean))].sort(),
        sourceUrl: representative.sourceUrl,
        duplicateIds: group
          .filter((item) => item.id !== representative.id)
          .map((item) => item.id)
          .slice(0, 8)
      });
    }
  }

  deduped.sort(compareByDateThenImportance);
  duplicateGroups.sort((a, b) => b.count - a.count || (a.title || "").localeCompare(b.title || ""));

  return {
    items: deduped,
    groups: duplicateGroups,
    rawItems: items.length,
    uniqueItems: deduped.length,
    duplicatesRemoved: items.length - deduped.length
  };
}

function buildDedupeMeta(enabled, dedupeResult) {
  return {
    enabled,
    rawItems: dedupeResult.rawItems,
    uniqueItems: dedupeResult.uniqueItems,
    duplicatesRemoved: dedupeResult.duplicatesRemoved,
    groups: dedupeResult.groups.slice(0, 10)
  };
}

function duplicateKey(item) {
  const title = canonicalTitle(item.title || item.shortTitle);
  if (!title) return undefined;
  const url = normalizeSourceUrlForKey(item.sourceUrl);
  if (url) return `url:${url}::title:${title}`;
  return `date:${item.date || "unknown"}::kind:${releaseKind(item)}::title:${title}`;
}

function canonicalTitle(value) {
  return decodeHtml(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .split("|")[0]
    .toLowerCase()
    .replace(/\b(?:announcing|announced|introducing|introduced)\b/g, " ")
    .replace(/\b(?:launches|launched|launch)\b/g, " ")
    .replace(/^\s*[a-z]+\s+\d{1,2},\s+\d{4}\s*[-—:]\s*/i, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number.parseInt(number, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeSourceUrlForKey(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value).trim().toLowerCase() || undefined;
  }
}

function representativeScore(item) {
  return ((item.importance || 1) * 10)
    + (item.whatChanged ? 6 : 0)
    + (item.entityId && item.entityId !== "ai-events" ? 3 : 0)
    + (item.status ? 1 : 0)
    + (asArray(item.audience).length ? 1 : 0)
    + (asArray(item.tags).length ? 1 : 0)
    + (item.sourceUrl ? 1 : 0);
}

function compareByImportanceThenDate(a, b) {
  const importanceDelta = (b.importance || 1) - (a.importance || 1);
  if (importanceDelta !== 0) return importanceDelta;
  return compareByDateThenImportance(a, b);
}

function compareByDateThenImportance(a, b) {
  if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
  const importanceDelta = (b.importance || 1) - (a.importance || 1);
  if (importanceDelta !== 0) return importanceDelta;
  return (a.title || "").localeCompare(b.title || "");
}

function formatCount(entry) {
  return `${entry.name} (${entry.count})`;
}

function formatItemCount(count) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function hasAnyTag(item, tags) {
  const set = new Set(asArray(item.tags));
  return tags.some((tag) => set.has(tag));
}

function textIncludesAny(item, needles) {
  const text = [
    item.title,
    item.shortTitle,
    item.whatChanged,
    item.entityName,
    ...asArray(item.tags)
  ].filter(Boolean).join(" ").toLowerCase();
  return needles.some((needle) => text.includes(needle));
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function countMany(items, keysFn) {
  const counts = new Map();
  for (const item of items) {
    for (const key of keysFn(item)) {
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function topCounts(counts, limit) {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function weekStart(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return "unknown";
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function releaseKind(item) {
  return item.kind || "release";
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return "https://releaselog.site";
  }
}

function requiredString(args, key) {
  const value = stringArg(args, key);
  if (!value) throw new Error(`Missing required argument: ${key}`);
  return value;
}

function stringArg(args, key) {
  const value = args?.[key];
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function intArg(args, key, fallback, min, max) {
  const raw = args?.[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function booleanArg(args, key, fallback) {
  const raw = args?.[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw === "boolean") return raw;
  if (String(raw).toLowerCase() === "true") return true;
  if (String(raw).toLowerCase() === "false") return false;
  return fallback;
}

function enumArg(args, key, allowed) {
  const value = stringArg(args, key);
  if (!value) return undefined;
  if (!allowed.includes(value)) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function dateArg(args, key) {
  const value = stringArg(args, key);
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${key} must be a YYYY-MM-DD date.`);
  }
  return value;
}

function dropUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function publicToolDefinition(tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations
  };
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false
  };
}

function objectOutputSchema() {
  return {
    type: "object",
    additionalProperties: true
  };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: dropUndefined({ code, message, data })
  };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleRequest(message) {
  const hasId = Object.prototype.hasOwnProperty.call(message, "id");
  try {
    if (message.method === "initialize") {
      if (hasId) {
        send(jsonRpcResult(message.id, {
          protocolVersion: message.params?.protocolVersion || DEFAULT_PROTOCOL_VERSION,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          }
        }));
      }
      return;
    }

    if (message.method === "notifications/initialized") {
      return;
    }

    if (message.method === "tools/list") {
      send(jsonRpcResult(message.id, {
        tools: tools.map(publicToolDefinition)
      }));
      return;
    }

    if (message.method === "tools/call") {
      const name = message.params?.name;
      const tool = toolMap.get(name);
      if (!tool) {
        send(jsonRpcError(message.id, -32602, `Unknown tool: ${name}`));
        return;
      }
      const result = await tool.handler(message.params?.arguments || {});
      send(jsonRpcResult(message.id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        structuredContent: result
      }));
      return;
    }

    if (hasId) {
      send(jsonRpcError(message.id, -32601, `Method not found: ${message.method}`));
    }
  } catch (error) {
    if (hasId) {
      send(jsonRpcError(message.id, -32000, error instanceof Error ? error.message : String(error)));
    } else {
      console.error(error);
    }
  }
}

async function runSelfTest() {
  const result = await trendSummary({ days: 7, limit: 50 });
  console.log(JSON.stringify({
    ok: true,
    server: SERVER_NAME,
    apiBase: API_BASE,
    analyzed: result.totals.analyzed,
    dedupe: result.dedupe,
    range: result.range,
    headline: result.brief.headline,
    topThemes: result.topThemes.slice(0, 3).map(({ name, count }) => ({ name, count })),
    trendLines: result.trendLines,
    topEntities: result.leaders.entities.slice(0, 3),
    latestItems: result.latestItems.slice(0, 3)
  }, null, 2));
}

if (process.argv.includes("--self-test")) {
  runSelfTest().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else if (process.argv.includes("--list-tools")) {
  console.log(JSON.stringify(tools.map(publicToolDefinition), null, 2));
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch (error) {
      send(jsonRpcError(null, -32700, "Parse error", error instanceof Error ? error.message : String(error)));
      return;
    }
    handleRequest(message);
  });
}

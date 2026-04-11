export type ReleaseAudience = "end_user" | "developer" | "admin" | "partner";

export type ReleaseStatus = "stable" | "preview" | "beta" | "deprecated";

export const RELEASE_AUDIENCES: readonly ReleaseAudience[] = [
  "end_user",
  "developer",
  "admin",
  "partner",
] as const;

export const RELEASE_STATUSES: readonly ReleaseStatus[] = [
  "stable",
  "preview",
  "beta",
  "deprecated",
] as const;

export function isReleaseAudience(s: string): s is ReleaseAudience {
  return (RELEASE_AUDIENCES as readonly string[]).includes(s);
}

export function isReleaseStatus(s: string): s is ReleaseStatus {
  return (RELEASE_STATUSES as readonly string[]).includes(s);
}

export type ReleaseHowTo = {
  steps: string[];
  prerequisites?: string[];
};

export type ReleaseItem = {
  id: string;
  date: string;
  title: string;
  shortTitle?: string;
  slug?: string;
  description?: string;
  /** One-line “what changed” for lists and agent summaries. */
  whatChanged?: string;
  howTo?: ReleaseHowTo;
  /** Extra docs beyond the primary announcement (`sourceUrl`). */
  docUrls?: string[];
  tags?: string[];
  sourceUrl?: string;
  importance?: 1 | 2 | 3;
  audience?: ReleaseAudience | ReleaseAudience[];
  status?: ReleaseStatus;
  relatedIds?: string[];
};

export type ThemeConfig = {
  primary: string;
  bgPage: string;
  bgPanel: string;
  bgEmptyCell: string;
  bgActiveCell: string;
  textPrimary: string;
  textSecondary: string;
  accentNumber: string;
};

export type TeamMember = {
  name: string;
  handle?: string;
  avatar?: string;
};

export type EntityConfig = {
  id: string;
  name: string;
  type: "team" | "product";
  description?: string;
  logo?: string;
  headline?: string;
  subtitle?: string;
  footnote?: string;
  brandLine?: string;
  brandUrl?: string;
  members?: TeamMember[];
  theme?: ThemeConfig;
  releases: ReleaseItem[];
};

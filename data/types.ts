export type ReleaseItem = {
  id: string;
  date: string;
  title: string;
  shortTitle?: string;
  description?: string;
  tags?: string[];
  sourceUrl?: string;
  importance?: 1 | 2 | 3;
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

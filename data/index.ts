import type { EntityConfig } from "./types";
import apiTeam from "./entities/api-team.json";
import claudeProduct from "./entities/claude-product.json";
import claudeTeam from "./entities/claude-team.json";

export type { EntityConfig, ReleaseItem, ThemeConfig } from "./types";
export { defaultTheme } from "./defaultTheme";

export const entities: EntityConfig[] = [
  claudeTeam as EntityConfig,
  apiTeam as EntityConfig,
  claudeProduct as EntityConfig,
];

export function getEntityById(id: string): EntityConfig | undefined {
  return entities.find((e) => e.id === id);
}

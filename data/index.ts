import { loadEntitiesFromRegistry } from "./load-entities";
import type { EntityConfig } from "./types";

export type {
  EntityConfig,
  ReleaseItem,
  ReleaseHowTo,
  ReleaseAudience,
  ReleaseStatus,
  ThemeConfig,
} from "./types";
export { defaultTheme } from "./defaultTheme";

export const entities: EntityConfig[] = loadEntitiesFromRegistry();

export function getEntityById(id: string): EntityConfig | undefined {
  return entities.find((e) => e.id === id);
}

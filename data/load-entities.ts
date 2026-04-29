import type { EntityConfig } from "./types";
import registry from "./entity-registry.json";
import anthropicTeam from "./entities/anthropic-team.json";
import apiTeam from "./entities/api-team.json";
import claudeProduct from "./entities/claude-product.json";
import openaiTeam from "./entities/openai-team.json";
import deepseekTeam from "./entities/deepseek-team.json";
import vllmTeam from "./entities/vllm-team.json";

const entityByFile: Record<string, EntityConfig> = {
  "anthropic-team.json": anthropicTeam as EntityConfig,
  "api-team.json": apiTeam as EntityConfig,
  "claude-product.json": claudeProduct as EntityConfig,
  "openai-team.json": openaiTeam as EntityConfig,
  "deepseek-team.json": deepseekTeam as EntityConfig,
  "vllm-team.json": vllmTeam as EntityConfig,
};

export function loadEntitiesFromRegistry(): EntityConfig[] {
  const files = registry.entities;
  return files.map((filename) => {
    const entity = entityByFile[filename];
    if (!entity) {
      throw new Error(
        `entity-registry.json lists "${filename}" but it is not registered in data/load-entities.ts`,
      );
    }
    return entity;
  });
}

import { listAnthropicModels } from "./anthropic";
import { listDeepSeekModels } from "./deepseek";
import { listOpenRouterModels } from "./openrouter";
import type { Provider } from "./router";

export interface CatalogModel {
  id: string;
  label: string;
  supportsStructuredOutputs: boolean;
}

// Catalogues change rarely, so an in-process cache is enough; a redeploy simply refetches.
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<Provider, { fetchedAt: number; models: CatalogModel[] }>();

function fetcherFor(provider: Provider) {
  switch (provider) {
    case "anthropic":
      return listAnthropicModels;
    case "openrouter":
      return listOpenRouterModels;
    case "deepseek":
      return listDeepSeekModels;
  }
}

export function getCachedModels(provider: Provider): CatalogModel[] | null {
  const entry = cache.get(provider);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
  return entry.models;
}

export function clearModelCache(provider?: Provider): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}

export async function listModels(
  provider: Provider,
  apiKey: string,
  options: { forceRefresh?: boolean } = {},
): Promise<CatalogModel[]> {
  if (!options.forceRefresh) {
    const cached = getCachedModels(provider);
    if (cached) return cached;
  }

  const models = await fetcherFor(provider)(apiKey);
  const sorted = [...models].sort((a, b) => a.label.localeCompare(b.label));
  cache.set(provider, { fetchedAt: Date.now(), models: sorted });

  return sorted;
}

export function findModel(models: CatalogModel[], id: string): CatalogModel | null {
  return models.find((model) => model.id === id) ?? null;
}

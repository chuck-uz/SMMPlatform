import { decrypt } from "../encryption";
import { prisma } from "../prisma";
import { findModel, getCachedModels, listModels } from "./catalog";
import { resolveCredential, resolveRoute, type InteractionType, type Provider } from "./router";

export interface ResolvedInteraction {
  provider: Provider;
  model: string;
  apiKey: string;
  supportsStructuredOutputs?: boolean;
}

export interface InteractionOverride {
  provider?: Provider;
  model?: string;
}

// Single place where "which model handles this" turns into a usable, decrypted credential.
// Call sites no longer read the key themselves, so a settings change actually takes effect.
export async function resolveInteraction(
  interactionType: InteractionType,
  override?: InteractionOverride,
): Promise<ResolvedInteraction> {
  const [routes, credentials] = await Promise.all([
    prisma.llmRouteConfig.findMany(),
    prisma.llmProviderCredential.findMany(),
  ]);

  const routed = resolveRoute(interactionType, routes);
  const provider = override?.provider ?? routed.provider;
  const model = override?.model?.trim() || routed.model;

  const credential = resolveCredential(provider, credentials);

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY не настроен — расшифровать ключ провайдера невозможно");
  }

  const apiKey = decrypt(credential.encryptedApiKey, encryptionKey);

  return {
    provider,
    model,
    apiKey,
    supportsStructuredOutputs: await lookupStructuredOutputSupport(provider, model, apiKey),
  };
}

// Only OpenRouter varies per model. Anthropic always supports schemas and DeepSeek never
// does, so those are decided by the mechanism picker without a catalogue lookup.
async function lookupStructuredOutputSupport(
  provider: Provider,
  model: string,
  apiKey: string,
): Promise<boolean | undefined> {
  if (provider !== "openrouter") return undefined;

  const cached = getCachedModels("openrouter");
  if (cached) return findModel(cached, model)?.supportsStructuredOutputs ?? false;

  try {
    const models = await listModels("openrouter", apiKey);
    return findModel(models, model)?.supportsStructuredOutputs ?? false;
  } catch {
    // Catalogue unavailable: assume no schema support and let the prompt fallback carry it.
    return false;
  }
}

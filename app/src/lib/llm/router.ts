// Resolves "which model answers this kind of interaction" from the admin's configuration,
// falling back to the behaviour the app had before the model layer existed.

export const INTERACTION_TYPES = ["agent_dialog", "comment_reply", "analytics", "content_plan"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const SUPPORTED_PROVIDERS = ["anthropic", "openrouter", "deepseek"] as const;
export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

export interface RouteTarget {
  provider: Provider;
  model: string;
}

export const DEFAULT_ROUTES: Record<InteractionType, RouteTarget> = {
  agent_dialog: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  comment_reply: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  analytics: { provider: "anthropic", model: "claude-sonnet-5" },
  content_plan: { provider: "anthropic", model: "claude-sonnet-5" },
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  agent_dialog: "Диалог агента",
  comment_reply: "Автоответы на комментарии",
  analytics: "AI-разбор аналитики",
  content_plan: "Контент-план (AI)",
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
};

export function isInteractionType(value: string): value is InteractionType {
  return (INTERACTION_TYPES as readonly string[]).includes(value);
}

export function isSupportedProvider(value: string): value is Provider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

export interface RouteRow {
  interactionType: string;
  provider: string;
  model: string;
}

// A malformed row (unknown provider, blank model) is ignored rather than fatal: a typo in
// one setting should not take the agent offline, it should quietly fall back.
export function resolveRoute(interactionType: InteractionType, routes: RouteRow[]): RouteTarget {
  const row = routes.find((route) => route.interactionType === interactionType);

  if (row && isSupportedProvider(row.provider) && row.model.trim().length > 0) {
    return { provider: row.provider, model: row.model.trim() };
  }

  return DEFAULT_ROUTES[interactionType];
}

export interface CredentialRow {
  provider: string;
  encryptedApiKey: string;
  verified: boolean;
}

export function resolveCredential(provider: string, credentials: CredentialRow[]): CredentialRow {
  const credential = credentials.find((item) => item.provider === provider);

  if (!credential || credential.encryptedApiKey.trim().length === 0) {
    const label = isSupportedProvider(provider) ? PROVIDER_LABELS[provider] : provider;
    throw new Error(`Не настроен API-ключ провайдера ${label} (${provider}) — добавьте его в «Подключениях»`);
  }

  return credential;
}

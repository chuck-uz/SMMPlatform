import { listAnthropicModels } from "./anthropic";
import { listDeepSeekModels } from "./deepseek";
import { listOpenRouterModels } from "./openrouter";
import type { ProviderKeyVerifier } from "./credentials";
import type { Provider } from "./router";

// Listing models is the cheapest authenticated call every provider offers, so a successful
// catalogue fetch doubles as key verification.
export function providerVerifier(provider: Provider): ProviderKeyVerifier {
  const list =
    provider === "anthropic" ? listAnthropicModels : provider === "openrouter" ? listOpenRouterModels : listDeepSeekModels;

  return {
    async verifyKey(apiKey: string) {
      const models = await list(apiKey);
      return models.length > 0;
    },
  };
}

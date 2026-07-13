import type { ClaudeApiClient } from "./claudeApiKey";

const MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION = "2023-06-01";

export const claudeApiClient: ClaudeApiClient = {
  async verifyKey(apiKey: string): Promise<boolean> {
    const response = await fetch(MODELS_URL, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
    });

    return response.ok;
  },
};

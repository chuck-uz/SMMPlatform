export interface ClaudeApiClient {
  verifyKey(apiKey: string): Promise<boolean>;
}

export async function connectClaudeApiKey(
  apiKey: string,
  deps: { client: ClaudeApiClient; encrypt: (plaintext: string) => string },
): Promise<{ encryptedApiKey: string; verified: boolean }> {
  if (!apiKey.trim()) {
    throw new Error("API-ключ не может быть пустым");
  }

  let verified: boolean;
  try {
    verified = await deps.client.verifyKey(apiKey);
  } catch {
    verified = false;
  }

  return { encryptedApiKey: deps.encrypt(apiKey), verified };
}

export interface ProviderKeyVerifier {
  verifyKey(apiKey: string): Promise<boolean>;
}

// Generalised from the original Claude-only helper: encrypt whatever the admin pasted and
// record whether the provider accepted it. A failed verification is stored, not rejected —
// a provider outage should not stop the key being saved.
export async function connectProviderApiKey(
  apiKey: string,
  deps: { verifier: ProviderKeyVerifier; encrypt: (plaintext: string) => string },
): Promise<{ encryptedApiKey: string; verified: boolean }> {
  if (!apiKey.trim()) {
    throw new Error("API-ключ не может быть пустым");
  }

  let verified: boolean;
  try {
    verified = await deps.verifier.verifyKey(apiKey);
  } catch {
    verified = false;
  }

  return { encryptedApiKey: deps.encrypt(apiKey), verified };
}

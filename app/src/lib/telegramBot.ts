export interface TelegramBotClient {
  verifyToken(botToken: string): Promise<boolean>;
}

export async function connectTelegramBot(
  botToken: string,
  deps: { client: TelegramBotClient; encrypt: (plaintext: string) => string },
): Promise<{ encryptedBotToken: string; verified: boolean }> {
  if (!botToken.trim()) {
    throw new Error("Токен бота не может быть пустым");
  }

  let verified: boolean;
  try {
    verified = await deps.client.verifyToken(botToken);
  } catch {
    verified = false;
  }

  return { encryptedBotToken: deps.encrypt(botToken), verified };
}

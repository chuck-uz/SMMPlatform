import type { TelegramBotClient } from "./telegramBot";

function apiUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

export const telegramBotClient: TelegramBotClient = {
  async verifyToken(botToken: string): Promise<boolean> {
    const response = await fetch(apiUrl(botToken, "getMe"));
    return response.ok;
  },
};

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(apiUrl(botToken, "sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API error ${response.status}: ${await response.text()}`);
  }
}

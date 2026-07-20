import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import { isLeadComplete, mergeLeadFields, type LeadFields } from "./leadFields";
import { buildLeadNotificationText, type LeadNotificationInput } from "./leadNotify";
import { sendTelegramMessage } from "./telegramClient";

export async function saveLeadDraft(conversationId: string, fields: LeadFields, source: string) {
  const existing = await prisma.lead.findUnique({ where: { conversationId } });

  // Merge, never replace: the model sends a full snapshot each turn but does not reliably
  // repeat what it already gathered, so a plain overwrite silently drops collected data —
  // and a lead reaching the manager without a destination is the worst outcome here.
  const merged = mergeLeadFields(existing, fields);
  const completeness = isLeadComplete(merged) ? "complete" : "partial";

  if (existing) {
    return prisma.lead.update({ where: { conversationId }, data: { ...merged, completeness } });
  }

  const lead = await prisma.lead.create({ data: { conversationId, ...merged, completeness, source } });
  await notifyNewLead(lead);

  return lead;
}

async function notifyNewLead(lead: LeadNotificationInput) {
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) return;

    const [botConfig, recipients] = await Promise.all([
      prisma.telegramBotConfig.findUnique({ where: { singleton: "telegram" } }),
      prisma.telegramNotificationRecipient.findMany(),
    ]);
    if (!botConfig?.verified || recipients.length === 0) return;

    const botToken = decrypt(botConfig.encryptedBotToken, encryptionKey);
    const text = buildLeadNotificationText(lead);

    for (const recipient of recipients) {
      try {
        await sendTelegramMessage(botToken, recipient.chatId, text);
      } catch (error) {
        console.error(`[leadIntake] failed to notify chatId ${recipient.chatId}`, error);
      }
    }
  } catch (error) {
    console.error("[leadIntake] failed to send Telegram notifications", error);
  }
}

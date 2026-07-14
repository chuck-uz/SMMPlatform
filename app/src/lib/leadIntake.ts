import { prisma } from "./prisma";
import { isLeadComplete, type LeadFields } from "./leadFields";

export async function saveLeadDraft(conversationId: string, fields: LeadFields) {
  const status = isLeadComplete(fields) ? "complete" : "partial";

  return prisma.lead.upsert({
    where: { conversationId },
    create: { conversationId, ...fields, status },
    update: { ...fields, status },
  });
}

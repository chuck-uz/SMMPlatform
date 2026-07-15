"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_LEAD_STATUSES = ["new", "in_progress", "closed"] as const;
type LeadStatus = (typeof ALLOWED_LEAD_STATUSES)[number];

export async function updateLeadStatusAction(id: string, status: LeadStatus) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Требуется вход");
  }

  // Server-action arguments aren't validated by the type system at runtime.
  if (!ALLOWED_LEAD_STATUSES.includes(status)) {
    throw new Error("Недопустимый статус заявки");
  }

  await prisma.lead.update({ where: { id }, data: { status } });

  revalidatePath("/panel/leads");
}

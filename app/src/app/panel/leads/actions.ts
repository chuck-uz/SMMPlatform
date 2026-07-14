"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function updateLeadStatusAction(id: string, status: "new" | "in_progress" | "closed") {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Требуется вход");
  }

  await prisma.lead.update({ where: { id }, data: { status } });

  revalidatePath("/panel/leads");
}

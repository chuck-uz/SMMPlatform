"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function disconnectInstagramAccountAction(accountId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Требуется вход");
  }

  await prisma.instagramAccount.delete({ where: { id: accountId } });

  revalidatePath("/panel/connections");
}

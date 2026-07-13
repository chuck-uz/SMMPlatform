"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/createUser";
import { setUserActive } from "@/lib/setUserActive";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Доступ только для администратора");
  }
  return session;
}

export async function createUserAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  const result = await createUser(
    { email, password, role },
    {
      findUserByEmail: (email) => prisma.user.findUnique({ where: { email } }),
      insertUser: (data) => prisma.user.create({ data }),
    },
  );

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/panel/users");
  return {};
}

export async function setUserActiveAction(targetUserId: string, isActive: boolean) {
  const session = await requireAdmin();

  const result = await setUserActive(session.user!.id!, targetUserId, isActive, {
    updateIsActive: (id, isActive) =>
      prisma.user.update({ where: { id }, data: { isActive } }).then(() => undefined),
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath("/panel/users");
}

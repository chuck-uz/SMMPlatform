"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { changePassword } from "@/lib/changePassword";

export async function changePasswordAction(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Сессия истекла, войдите заново" };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return { error: "Новый пароль и подтверждение не совпадают" };
  }

  const result = await changePassword(session.user.id, currentPassword, newPassword, {
    findUserById: (id) => prisma.user.findUnique({ where: { id } }),
    updatePasswordHash: (id, passwordHash) =>
      prisma.user.update({ where: { id }, data: { passwordHash } }).then(() => undefined),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: true };
}

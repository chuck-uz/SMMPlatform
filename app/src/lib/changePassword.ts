import bcrypt from "bcryptjs";

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  deps: {
    findUserById: (id: string) => Promise<{ passwordHash: string } | null>;
    updatePasswordHash: (id: string, passwordHash: string) => Promise<void>;
  },
): Promise<ChangePasswordResult> {
  const user = await deps.findUserById(userId);
  if (!user) {
    return { ok: false, error: "Пользователь не найден" };
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return { ok: false, error: "Неверный текущий пароль" };
  }

  if (newPassword.length < 8) {
    return { ok: false, error: "Новый пароль должен быть не короче 8 символов" };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  await deps.updatePasswordHash(userId, newPasswordHash);

  return { ok: true };
}

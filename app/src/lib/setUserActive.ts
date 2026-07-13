export type SetUserActiveResult = { ok: true } | { ok: false; error: string };

export async function setUserActive(
  actingUserId: string,
  targetUserId: string,
  isActive: boolean,
  deps: { updateIsActive: (id: string, isActive: boolean) => Promise<void> },
): Promise<SetUserActiveResult> {
  if (actingUserId === targetUserId && !isActive) {
    return { ok: false, error: "Нельзя деактивировать свою же учётную запись" };
  }

  await deps.updateIsActive(targetUserId, isActive);
  return { ok: true };
}

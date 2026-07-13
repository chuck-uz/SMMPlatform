import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { changePassword } from "./changePassword";

const CURRENT_PASSWORD = "correct-horse-battery-staple";

async function makeDeps(passwordHash: string) {
  let storedHash = passwordHash;
  return {
    findUserById: async (id: string) =>
      id === "user_1" ? { passwordHash: storedHash } : null,
    updatePasswordHash: async (_id: string, newHash: string) => {
      storedHash = newHash;
    },
    getStoredHash: () => storedHash,
  };
}

describe("changePassword", () => {
  it("updates the password hash when the current password is correct", async () => {
    const deps = await makeDeps(await bcrypt.hash(CURRENT_PASSWORD, 10));

    const result = await changePassword("user_1", CURRENT_PASSWORD, "brand-new-password", deps);

    expect(result).toEqual({ ok: true });
    expect(await bcrypt.compare("brand-new-password", deps.getStoredHash())).toBe(true);
  });

  it("rejects when the current password is wrong", async () => {
    const deps = await makeDeps(await bcrypt.hash(CURRENT_PASSWORD, 10));

    const result = await changePassword("user_1", "wrong-password", "brand-new-password", deps);

    expect(result).toEqual({ ok: false, error: "Неверный текущий пароль" });
  });

  it("rejects when the new password is too short", async () => {
    const deps = await makeDeps(await bcrypt.hash(CURRENT_PASSWORD, 10));

    const result = await changePassword("user_1", CURRENT_PASSWORD, "short", deps);

    expect(result).toEqual({
      ok: false,
      error: "Новый пароль должен быть не короче 8 символов",
    });
  });

  it("rejects when the user does not exist", async () => {
    const deps = await makeDeps(await bcrypt.hash(CURRENT_PASSWORD, 10));

    const result = await changePassword("nobody", CURRENT_PASSWORD, "brand-new-password", deps);

    expect(result).toEqual({ ok: false, error: "Пользователь не найден" });
  });
});

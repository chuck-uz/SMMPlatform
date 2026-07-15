import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createUser } from "./createUser";

function makeDeps(existingEmails: string[] = []) {
  const inserted: any[] = [];
  return {
    findUserByEmail: async (email: string) =>
      existingEmails.includes(email) ? { id: "existing_user" } : null,
    insertUser: async (data: { email: string; passwordHash: string; role: string }) => {
      const user = { id: `user_${inserted.length + 1}`, email: data.email, role: data.role };
      inserted.push({ ...data, id: user.id });
      return user;
    },
    getInserted: () => inserted,
  };
}

describe("createUser", () => {
  it("creates a user with a hashed password", async () => {
    const deps = makeDeps();

    const result = await createUser(
      { email: "manager@example.com", password: "a-strong-password", role: "manager" },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      user: { id: "user_1", email: "manager@example.com", role: "manager" },
    });

    const [stored] = deps.getInserted();
    expect(stored.passwordHash).not.toBe("a-strong-password");
    expect(await bcrypt.compare("a-strong-password", stored.passwordHash)).toBe(true);
  });

  it("normalizes the email to lowercase and trims it before storing", async () => {
    const deps = makeDeps();

    const result = await createUser(
      { email: "  Manager@Example.COM ", password: "a-strong-password", role: "manager" },
      deps,
    );

    expect(result.ok).toBe(true);
    const [stored] = deps.getInserted();
    expect(stored.email).toBe("manager@example.com");
  });

  it("rejects a malformed email", async () => {
    const deps = makeDeps();

    const result = await createUser(
      { email: "not-an-email", password: "a-strong-password", role: "manager" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Некорректный email" });
  });

  it("rejects a password shorter than 8 characters", async () => {
    const deps = makeDeps();

    const result = await createUser(
      { email: "manager@example.com", password: "short", role: "manager" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Пароль должен быть не короче 8 символов" });
  });

  it("rejects an unknown role", async () => {
    const deps = makeDeps();

    const result = await createUser(
      { email: "manager@example.com", password: "a-strong-password", role: "superadmin" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Недопустимая роль" });
  });

  it("rejects a duplicate email", async () => {
    const deps = makeDeps(["manager@example.com"]);

    const result = await createUser(
      { email: "manager@example.com", password: "a-strong-password", role: "manager" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Пользователь с таким email уже существует" });
  });
});

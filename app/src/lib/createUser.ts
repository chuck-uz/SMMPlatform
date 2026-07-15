import bcrypt from "bcryptjs";

export const ALLOWED_ROLES = ["admin", "manager"] as const;
export type Role = (typeof ALLOWED_ROLES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreatedUser = { id: string; email: string; role: string };

export type CreateUserResult = { ok: true; user: CreatedUser } | { ok: false; error: string };

export async function createUser(
  input: { email: string; password: string; role: string },
  deps: {
    findUserByEmail: (email: string) => Promise<{ id: string } | null>;
    insertUser: (data: {
      email: string;
      passwordHash: string;
      role: string;
    }) => Promise<CreatedUser>;
  },
): Promise<CreateUserResult> {
  // Normalize the email so a user created as "User@Example.com" can log in as
  // "user@example.com" (login looks up by the normalized address).
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Некорректный email" };
  }

  if (input.password.length < 8) {
    return { ok: false, error: "Пароль должен быть не короче 8 символов" };
  }

  if (!ALLOWED_ROLES.includes(input.role as Role)) {
    return { ok: false, error: "Недопустимая роль" };
  }

  const existing = await deps.findUserByEmail(email);
  if (existing) {
    return { ok: false, error: "Пользователь с таким email уже существует" };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await deps.insertUser({ email, passwordHash, role: input.role });

  return { ok: true, user };
}

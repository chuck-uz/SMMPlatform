import bcrypt from "bcryptjs";

export type CredentialsUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  role: string;
};

export async function verifyCredentials(
  email: unknown,
  password: unknown,
  findUser: (email: string) => Promise<UserRecord | null>,
): Promise<CredentialsUser | null> {
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }

  const user = await findUser(email);
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

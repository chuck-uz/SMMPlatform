import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { verifyCredentials, type UserRecord } from "./verifyCredentials";

const PLAIN_PASSWORD = "correct-horse-battery-staple";

async function makeUser(overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
  return {
    id: "user_1",
    email: "admin@example.com",
    passwordHash: await bcrypt.hash(PLAIN_PASSWORD, 10),
    name: null,
    role: "admin",
    ...overrides,
  };
}

describe("verifyCredentials", () => {
  it("returns the user when email and password match", async () => {
    const user = await makeUser();
    const findUser = async (email: string) => (email === user.email ? user : null);

    const result = await verifyCredentials(user.email, PLAIN_PASSWORD, findUser);

    expect(result).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  });

  it("returns null when the password is wrong", async () => {
    const user = await makeUser();
    const findUser = async (email: string) => (email === user.email ? user : null);

    const result = await verifyCredentials(user.email, "wrong-password", findUser);

    expect(result).toBeNull();
  });

  it("returns null when no user exists for the email", async () => {
    const findUser = async () => null;

    const result = await verifyCredentials("nobody@example.com", PLAIN_PASSWORD, findUser);

    expect(result).toBeNull();
  });

  it("returns null when email or password is missing or not a string", async () => {
    const findUser = async () => {
      throw new Error("findUser should not be called with invalid input");
    };

    expect(await verifyCredentials(undefined, PLAIN_PASSWORD, findUser)).toBeNull();
    expect(await verifyCredentials("admin@example.com", undefined, findUser)).toBeNull();
    expect(await verifyCredentials(123, PLAIN_PASSWORD, findUser)).toBeNull();
  });
});

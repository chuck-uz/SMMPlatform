import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { encrypt, decrypt } from "./encryption";

const KEY = crypto.randomBytes(32).toString("base64");
const OTHER_KEY = crypto.randomBytes(32).toString("base64");

describe("encrypt/decrypt", () => {
  it("round-trips a plaintext string", () => {
    const ciphertext = encrypt("ig-access-token-abc123", KEY);

    expect(decrypt(ciphertext, KEY)).toBe("ig-access-token-abc123");
  });

  it("produces different ciphertext for the same plaintext each time", () => {
    const a = encrypt("same-plaintext", KEY);
    const b = encrypt("same-plaintext", KEY);

    expect(a).not.toBe(b);
  });

  it("does not contain the plaintext in the ciphertext output", () => {
    const ciphertext = encrypt("super-secret-token", KEY);

    expect(ciphertext).not.toContain("super-secret-token");
  });

  it("fails to decrypt with the wrong key", () => {
    const ciphertext = encrypt("ig-access-token-abc123", KEY);

    expect(() => decrypt(ciphertext, OTHER_KEY)).toThrow();
  });

  it("fails to decrypt a tampered ciphertext", () => {
    const ciphertext = encrypt("ig-access-token-abc123", KEY);
    const parts = ciphertext.split(":");
    const tamperedBody = Buffer.from(parts[2], "base64");
    tamperedBody[0] ^= 0xff;
    const tampered = [parts[0], parts[1], tamperedBody.toString("base64")].join(":");

    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it("rejects a key that is not 32 bytes", () => {
    const shortKey = crypto.randomBytes(16).toString("base64");

    expect(() => encrypt("plaintext", shortKey)).toThrow();
  });
});

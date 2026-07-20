import { describe, expect, it, vi } from "vitest";
import { connectProviderApiKey } from "./credentials";

const encrypt = (plaintext: string) => `enc(${plaintext})`;

describe("connectProviderApiKey", () => {
  it("encrypts the key and records a successful verification", async () => {
    const verifier = { verifyKey: vi.fn(async () => true) };
    await expect(connectProviderApiKey("sk-test", { verifier, encrypt })).resolves.toEqual({
      encryptedApiKey: "enc(sk-test)",
      verified: true,
    });
    expect(verifier.verifyKey).toHaveBeenCalledWith("sk-test");
  });

  it("still stores the key when the provider rejects it", async () => {
    const verifier = { verifyKey: vi.fn(async () => false) };
    await expect(connectProviderApiKey("bad", { verifier, encrypt })).resolves.toEqual({
      encryptedApiKey: "enc(bad)",
      verified: false,
    });
  });

  // A provider being down must not prevent saving a key the admin knows is good.
  it("treats a thrown verification as unverified rather than fatal", async () => {
    const verifier = {
      verifyKey: vi.fn(async () => {
        throw new Error("network down");
      }),
    };
    await expect(connectProviderApiKey("sk-test", { verifier, encrypt })).resolves.toEqual({
      encryptedApiKey: "enc(sk-test)",
      verified: false,
    });
  });

  it("refuses an empty key", async () => {
    const verifier = { verifyKey: vi.fn(async () => true) };
    await expect(connectProviderApiKey("   ", { verifier, encrypt })).rejects.toThrow(/пустым/);
    expect(verifier.verifyKey).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { connectClaudeApiKey } from "./claudeApiKey";

describe("connectClaudeApiKey", () => {
  it("verifies the key and returns it encrypted with verified=true on success", async () => {
    const client = { verifyKey: vi.fn().mockResolvedValue(true) };
    const encrypt = vi.fn().mockReturnValue("encrypted-value");

    const result = await connectClaudeApiKey("sk-ant-real-key", { client, encrypt });

    expect(client.verifyKey).toHaveBeenCalledWith("sk-ant-real-key");
    expect(encrypt).toHaveBeenCalledWith("sk-ant-real-key");
    expect(result).toEqual({ encryptedApiKey: "encrypted-value", verified: true });
  });

  it("still encrypts and stores the key when verification fails, marked verified=false", async () => {
    const client = { verifyKey: vi.fn().mockResolvedValue(false) };
    const encrypt = vi.fn().mockReturnValue("encrypted-value");

    const result = await connectClaudeApiKey("sk-ant-bad-key", { client, encrypt });

    expect(result).toEqual({ encryptedApiKey: "encrypted-value", verified: false });
  });

  it("treats a verification network error as verified=false rather than throwing", async () => {
    const client = { verifyKey: vi.fn().mockRejectedValue(new Error("network down")) };
    const encrypt = vi.fn().mockReturnValue("encrypted-value");

    const result = await connectClaudeApiKey("sk-ant-key", { client, encrypt });

    expect(result).toEqual({ encryptedApiKey: "encrypted-value", verified: false });
  });

  it("rejects an empty key before calling the client", async () => {
    const client = { verifyKey: vi.fn() };
    const encrypt = vi.fn();

    await expect(connectClaudeApiKey("", { client, encrypt })).rejects.toThrow();
    expect(client.verifyKey).not.toHaveBeenCalled();
    expect(encrypt).not.toHaveBeenCalled();
  });
});

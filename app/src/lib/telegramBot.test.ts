import { describe, expect, it, vi } from "vitest";
import { connectTelegramBot } from "./telegramBot";

describe("connectTelegramBot", () => {
  it("verifies the token and returns it encrypted with verified=true on success", async () => {
    const client = { verifyToken: vi.fn().mockResolvedValue(true) };
    const encrypt = vi.fn().mockReturnValue("encrypted-value");

    const result = await connectTelegramBot("123:real-token", { client, encrypt });

    expect(client.verifyToken).toHaveBeenCalledWith("123:real-token");
    expect(encrypt).toHaveBeenCalledWith("123:real-token");
    expect(result).toEqual({ encryptedBotToken: "encrypted-value", verified: true });
  });

  it("still encrypts and stores the token when verification fails, marked verified=false", async () => {
    const client = { verifyToken: vi.fn().mockResolvedValue(false) };
    const encrypt = vi.fn().mockReturnValue("encrypted-value");

    const result = await connectTelegramBot("123:bad-token", { client, encrypt });

    expect(result).toEqual({ encryptedBotToken: "encrypted-value", verified: false });
  });

  it("treats a verification network error as verified=false rather than throwing", async () => {
    const client = { verifyToken: vi.fn().mockRejectedValue(new Error("network down")) };
    const encrypt = vi.fn().mockReturnValue("encrypted-value");

    const result = await connectTelegramBot("123:token", { client, encrypt });

    expect(result).toEqual({ encryptedBotToken: "encrypted-value", verified: false });
  });

  it("rejects an empty token before calling the client", async () => {
    const client = { verifyToken: vi.fn() };
    const encrypt = vi.fn();

    await expect(connectTelegramBot("", { client, encrypt })).rejects.toThrow();
    expect(client.verifyToken).not.toHaveBeenCalled();
    expect(encrypt).not.toHaveBeenCalled();
  });
});

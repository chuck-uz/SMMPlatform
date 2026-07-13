import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "./verifyWebhookSignature";

const SECRET = "test-app-secret";
const PAYLOAD = JSON.stringify({ object: "instagram", entry: [{ id: "123" }] });

function sign(payload: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hmac}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const header = sign(PAYLOAD, SECRET);

    expect(verifyWebhookSignature(PAYLOAD, header, SECRET)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const header = sign(PAYLOAD, "wrong-secret");

    expect(verifyWebhookSignature(PAYLOAD, header, SECRET)).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const header = sign(PAYLOAD, SECRET);
    const tampered = JSON.stringify({ object: "instagram", entry: [{ id: "999" }] });

    expect(verifyWebhookSignature(tampered, header, SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature(PAYLOAD, null, SECRET)).toBe(false);
  });

  it("rejects a malformed signature header without the sha256= prefix", () => {
    const hmac = crypto.createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");

    expect(verifyWebhookSignature(PAYLOAD, hmac, SECRET)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(verifyWebhookSignature(PAYLOAD, "sha256=abc123", SECRET)).toBe(false);
  });

  it("rejects an empty signature header", () => {
    expect(verifyWebhookSignature(PAYLOAD, "sha256=", SECRET)).toBe(false);
  });
});

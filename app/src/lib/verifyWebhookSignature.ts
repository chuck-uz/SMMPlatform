import crypto from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

  const receivedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  const expectedHex = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (received.length !== expected.length) return false;

  return crypto.timingSafeEqual(received, expected);
}

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTES,
  INTERACTION_TYPES,
  SUPPORTED_PROVIDERS,
  isInteractionType,
  isSupportedProvider,
  resolveCredential,
  resolveRoute,
} from "./router";

describe("catalogue of supported values", () => {
  it("recognises the three interaction points", () => {
    expect(INTERACTION_TYPES).toEqual(["agent_dialog", "comment_reply", "analytics"]);
    expect(isInteractionType("agent_dialog")).toBe(true);
    expect(isInteractionType("nonsense")).toBe(false);
  });

  it("recognises the three providers", () => {
    expect(SUPPORTED_PROVIDERS).toEqual(["anthropic", "openrouter", "deepseek"]);
    expect(isSupportedProvider("deepseek")).toBe(true);
    expect(isSupportedProvider("openai")).toBe(false);
  });

  // These defaults are what the app ran on before the model layer existed; they are the
  // safety net if the config rows are ever missing.
  it("defaults reproduce the pre-model-layer behaviour", () => {
    expect(DEFAULT_ROUTES.agent_dialog).toEqual({ provider: "anthropic", model: "claude-haiku-4-5-20251001" });
    expect(DEFAULT_ROUTES.comment_reply).toEqual({ provider: "anthropic", model: "claude-haiku-4-5-20251001" });
    expect(DEFAULT_ROUTES.analytics).toEqual({ provider: "anthropic", model: "claude-sonnet-5" });
  });
});

describe("resolveRoute", () => {
  it("uses the configured provider and model", () => {
    const routes = [{ interactionType: "agent_dialog", provider: "deepseek", model: "deepseek-chat" }];
    expect(resolveRoute("agent_dialog", routes)).toEqual({ provider: "deepseek", model: "deepseek-chat" });
  });

  it("falls back to the default when the interaction has no row", () => {
    expect(resolveRoute("analytics", [])).toEqual(DEFAULT_ROUTES.analytics);
  });

  it("does not let one interaction's row leak into another", () => {
    const routes = [{ interactionType: "analytics", provider: "deepseek", model: "deepseek-chat" }];
    expect(resolveRoute("agent_dialog", routes)).toEqual(DEFAULT_ROUTES.agent_dialog);
  });

  // Bad data in one row should not take the agent offline.
  it("ignores a row naming an unsupported provider", () => {
    const routes = [{ interactionType: "agent_dialog", provider: "openai", model: "gpt-4" }];
    expect(resolveRoute("agent_dialog", routes)).toEqual(DEFAULT_ROUTES.agent_dialog);
  });

  it("ignores a row with a blank model", () => {
    const routes = [{ interactionType: "agent_dialog", provider: "anthropic", model: "   " }];
    expect(resolveRoute("agent_dialog", routes)).toEqual(DEFAULT_ROUTES.agent_dialog);
  });
});

describe("resolveCredential", () => {
  const credentials = [
    { provider: "anthropic", encryptedApiKey: "enc-anthropic", verified: true },
    { provider: "deepseek", encryptedApiKey: "enc-deepseek", verified: false },
  ];

  it("returns the credential for the provider", () => {
    expect(resolveCredential("anthropic", credentials)).toEqual(credentials[0]);
  });

  // An unverified key is still worth trying: verification is a convenience check, and a
  // provider outage during verification should not permanently disable the key.
  it("returns an unverified credential rather than refusing", () => {
    expect(resolveCredential("deepseek", credentials)).toEqual(credentials[1]);
  });

  it("throws a message naming the missing provider", () => {
    expect(() => resolveCredential("openrouter", credentials)).toThrow(/openrouter/i);
  });

  it("throws when the stored key is blank", () => {
    expect(() => resolveCredential("anthropic", [{ provider: "anthropic", encryptedApiKey: "", verified: true }])).toThrow(
      /anthropic/i,
    );
  });
});

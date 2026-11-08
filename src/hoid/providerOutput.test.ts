import {
  DEFAULT_MAX_PROVIDER_TEXT_LENGTH,
  validProviderText,
} from "./providerOutput";

describe("validProviderText", () => {
  it("rejects malformed or empty provider output", () => {
    expect(validProviderText(undefined)).toBeNull();
    expect(validProviderText({ text: "respuesta" })).toBeNull();
    expect(validProviderText("   ")).toBeNull();
  });

  it("rejects output that becomes empty after invisible controls are removed", () => {
    expect(validProviderText("\\u0000\\u0001\\u200B\\u202E")).toBeNull();
  });

  it("canonicalizes provider text before spoiler checks", () => {
    expect(validProviderText("  Pre\\u200Bg\\u202Eunta  ")).toBe("Pregunta");
  });

  it("preserves readable Unicode wording for the spoiler guard", () => {
    expect(validProviderText("  ¿Qué pasó en Roshar?  ")).toBe("¿Qué pasó en Roshar?");
  });

  it("fails closed on oversized provider output before expensive spoiler checks", () => {
    const oversized = "x".repeat(DEFAULT_MAX_PROVIDER_TEXT_LENGTH + 1);
    expect(validProviderText(oversized)).toBeNull();
  });

  it("rejects invalid size limits conservatively", () => {
    expect(validProviderText("respuesta", 0)).toBeNull();
    expect(validProviderText("respuesta", Infinity)).toBeNull();
  });
});

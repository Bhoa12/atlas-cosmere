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

  it("preserves readable text while removing transport control characters", () => {
    expect(validProviderText("  Hola\u0000 mundo  ")).toBe("Hola mundo");
  });

  it("preserves Unicode wording for the spoiler guard instead of ASCII-normalizing it", () => {
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

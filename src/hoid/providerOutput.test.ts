import { validProviderText } from "./providerOutput";

describe("validProviderText", () => {
  it("rejects malformed or empty provider output", () => {
    expect(validProviderText(undefined)).toBeNull();
    expect(validProviderText({ text: "respuesta" })).toBeNull();
    expect(validProviderText("   ")).toBeNull();
  });

  it("preserves readable text while removing transport control characters", () => {
    expect(validProviderText("  Hola\u0000 mundo  ")).toBe("Hola mundo");
  });
});

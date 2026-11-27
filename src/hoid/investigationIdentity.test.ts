import { describe, expect, it } from "vitest";
import { fingerprintHoidInvestigationScope, fingerprintHoidInvestigationSubject } from "./investigationIdentity";

describe("Hoid investigation identity", () => {
  it("normalizes case and diacritics", () => {
    expect(fingerprintHoidInvestigationSubject("Personaje Alfa"))
      .toBe(fingerprintHoidInvestigationSubject("PERSONAJE ÁLFA"));
  });
  it("rejects empty, oversized and format-control labels", () => {
    expect(fingerprintHoidInvestigationSubject(" ")).toBeNull();
    expect(fingerprintHoidInvestigationSubject("Nombre\u0000oculto")).toBeNull();
    expect(fingerprintHoidInvestigationSubject("Nombre\u200Boculto")).toBeNull();
    expect(fingerprintHoidInvestigationSubject("x".repeat(257))).toBeNull();
  });
  it("binds selected works to progress identity", () => {
    const scope = { mode: "cross-work", bookIds: ["tfe", "twok"] };
    const first = fingerprintHoidInvestigationScope(4, "a".repeat(64), scope);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(fingerprintHoidInvestigationScope(5, "a".repeat(64), scope)).not.toBe(first);
    expect(fingerprintHoidInvestigationScope(4, "bad", scope)).toBeNull();
  });
});
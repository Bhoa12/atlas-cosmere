import { describe, expect, it } from "vitest";
import { isHoidRelationshipQuestion } from "./relationshipIntent";

describe("isHoidRelationshipQuestion", () => {
  it.each([
    "¿Qué relación hay entre Vin y Kelsier?",
    "¿Cómo se relacionan Kaladin y Syl?",
    "¿Qué conexión existe entre dos órdenes?",
    "¿Qué vínculo hay entre estas organizaciones?",
    "¿Qué tienen en común estos personajes?",
  ])("recognizes an explicit relational question: %s", question => {
    expect(isHoidRelationshipQuestion(question)).toBe(true);
  });

  it("normalizes accents without changing the original request", () => {
    expect(isHoidRelationshipQuestion("¿Qué relación existe entre A y B?")).toBe(true);
  });

  it("does not classify ordinary explanation or recommendation questions as relational", () => {
    expect(isHoidRelationshipQuestion("¿Cómo funciona este sistema de magia?")).toBe(false);
    expect(isHoidRelationshipQuestion("¿Qué libro debería leer después?")).toBe(false);
  });

  it("rejects malformed, oversized and control-character input", () => {
    expect(isHoidRelationshipQuestion(null)).toBe(false);
    expect(isHoidRelationshipQuestion("   ")).toBe(false);
    expect(isHoidRelationshipQuestion("¿Qué relación hay?\u0000")).toBe(false);
    expect(isHoidRelationshipQuestion("a".repeat(4_001))).toBe(false);
  });
});

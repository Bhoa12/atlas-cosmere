import { describe, expect, it } from "vitest";
import { HOID_KNOWLEDGE_KINDS, isHoidKnowledgeKind } from "./knowledgeKinds";

describe("canonical Hoid knowledge-kind contract", () => {
  it("exposes the complete stable closed vocabulary", () => {
    expect(HOID_KNOWLEDGE_KINDS).toEqual([
      "character",
      "place",
      "event",
      "phenomenon",
      "concept",
      "magic",
      "organization",
      "object",
    ]);
    expect(Object.isFrozen(HOID_KNOWLEDGE_KINDS)).toBe(true);
  });

  it("accepts every canonical kind through the shared runtime guard", () => {
    for (const kind of HOID_KNOWLEDGE_KINDS) {
      expect(isHoidKnowledgeKind(kind)).toBe(true);
    }
  });

  it("rejects unknown values without coercion", () => {
    for (const value of [null, undefined, 1, {}, [], "phenomena", "Character", new String("character")]) {
      expect(isHoidKnowledgeKind(value)).toBe(false);
    }
  });
});

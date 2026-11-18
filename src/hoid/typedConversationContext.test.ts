import { describe, expect, it } from "vitest";
import {
  createHoidTypedConversationContext,
  resolveHoidTypedEntityFollowUp,
  validateHoidTypedConversationContext,
} from "./typedConversationContext";

const progress = Object.freeze({ revision: 4, fingerprint: "a".repeat(64) });
const entities = Object.freeze([
  Object.freeze({ id: "e.a", kind: "character" as const }),
  Object.freeze({ id: "e.b", kind: "organization" as const }),
  Object.freeze({ id: "e.c", kind: "object" as const }),
  Object.freeze({ id: "e.d", kind: "magic" as const }),
]);

function context(items = entities) {
  const result = createHoidTypedConversationContext(items, progress);
  if (!result) throw new Error("Synthetic typed context invalid");
  return result;
}

describe("Hoid typed conversation context", () => {
  it("creates an immutable ID-and-kind-only context", () => {
    const result = context();
    expect(result.kind).toBe("typed-entity-follow-up");
    expect(result.entities).toEqual(entities);
    expect(JSON.stringify(result)).not.toMatch(/character-a|organization-a/);
    expect(result).not.toHaveProperty("names");
    expect(result).not.toHaveProperty("aliases");
    expect(result).not.toHaveProperty("question");
    expect(result).not.toHaveProperty("citations");
  });

  it("preserves entity order for deterministic conversation semantics", () => {
    const result = context([entities[2], entities[0]]);
    expect(result.entities.map(item => item.id)).toEqual(["e.c", "e.a"]);
  });

  it("rejects duplicate canonical IDs even when kinds differ", () => {
    expect(createHoidTypedConversationContext([
      { id: "entity.same", kind: "character" },
      { id: "entity.same", kind: "organization" },
    ], progress)).toBeNull();
  });

  it("rejects unsupported knowledge kinds", () => {
    expect(createHoidTypedConversationContext([
      { id: "entity.a", kind: "character" },
      { id: "entity.b", kind: "planet" },
    ], progress)).toBeNull();
  });

  it("rejects fewer than two or more than four entities", () => {
    expect(createHoidTypedConversationContext([entities[0]], progress)).toBeNull();
    expect(createHoidTypedConversationContext([...entities, { id: "entity.five", kind: "place" }], progress)).toBeNull();
  });

  it("rejects malformed IDs and extra fields", () => {
    expect(createHoidTypedConversationContext([
      { id: "__proto__", kind: "character" },
      { id: "entity.b", kind: "place" },
    ], progress)).toBeNull();
    expect(createHoidTypedConversationContext([
      { id: "entity.a", kind: "character", alias: "private name" },
      { id: "entity.b", kind: "place" },
    ], progress)).toBeNull();
  });

  it("rejects accessor-backed entity records without invoking accessors", () => {
    let invoked = false;
    const hostile = { kind: "character" } as Record<string, unknown>;
    Object.defineProperty(hostile, "id", {
      enumerable: true,
      get() { invoked = true; return "entity.a"; },
    });
    expect(createHoidTypedConversationContext([
      hostile,
      { id: "entity.b", kind: "place" },
    ], progress)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects sparse arrays and arrays with custom properties", () => {
    const sparse = new Array(2);
    sparse[1] = entities[1];
    expect(createHoidTypedConversationContext(sparse, progress)).toBeNull();
    const custom = [entities[0], entities[1]] as unknown[] & { extra?: string };
    custom.extra = "unexpected";
    expect(createHoidTypedConversationContext(custom, progress)).toBeNull();
  });

  it("rejects malformed progress identity", () => {
    expect(createHoidTypedConversationContext(entities, { revision: -1, fingerprint: "a".repeat(64) })).toBeNull();
    expect(createHoidTypedConversationContext(entities, { revision: 4, fingerprint: "bad" })).toBeNull();
  });

  it("validates the exact progress revision and fingerprint", () => {
    expect(validateHoidTypedConversationContext(context(), progress).status).toBe("valid");
    expect(validateHoidTypedConversationContext(context(), {
      revision: 5,
      fingerprint: "a".repeat(64),
    })).toEqual({ status: "unavailable", reason: "stale-context" });
    expect(validateHoidTypedConversationContext(context(), {
      revision: 4,
      fingerprint: "b".repeat(64),
    })).toEqual({ status: "unavailable", reason: "stale-context" });
  });

  it("distinguishes missing and malformed contexts", () => {
    expect(validateHoidTypedConversationContext(undefined, progress))
      .toEqual({ status: "unavailable", reason: "missing-context" });
    expect(validateHoidTypedConversationContext({ ...context(), extra: true }, progress))
      .toEqual({ status: "unavailable", reason: "invalid-context" });
  });

  it("resolves a unique organization by its explicit noun category", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Y esa organización?", context(), progress)).toMatchObject({
      status: "resolved",
      entityId: "e.b",
      entityKind: "organization",
    });
  });

  it("resolves magic only from the explicit magic noun phrase", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Y ese sistema de magia?", context(), progress)).toMatchObject({
      status: "resolved",
      entityId: "e.d",
      entityKind: "magic",
    });
  });

  it("does not infer a generic system from an underspecified phrase", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Y ese sistema?", context(), progress))
      .toEqual({ status: "unavailable", reason: "ambiguous-reference" });
  });

  it("abstains when a category has no entity in the context", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Y ese lugar?", context(), progress))
      .toEqual({ status: "unavailable", reason: "reference-unavailable" });
  });

  it("abstains when two entities share the requested category", () => {
    const ambiguous = context([
      { id: "entity.org-a", kind: "organization" },
      { id: "entity.org-b", kind: "organization" },
    ]);
    expect(resolveHoidTypedEntityFollowUp("¿Y esa organización?", ambiguous, progress))
      .toEqual({ status: "unavailable", reason: "ambiguous-reference" });
  });

  it("never resolves from stale context", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Y ese objeto?", context(), {
      revision: 4,
      fingerprint: "c".repeat(64),
    })).toEqual({ status: "unavailable", reason: "stale-context" });
  });

  it("never resolves a recognized category without context", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Y ese personaje?", undefined, progress))
      .toEqual({ status: "unavailable", reason: "missing-context" });
  });

  it("returns not-follow-up for an unrelated complete question", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Cómo funciona este concepto?", context(), progress))
      .toEqual({ status: "not-follow-up" });
  });

  it("normalizes Spanish diacritics without fuzzy matching", () => {
    expect(resolveHoidTypedEntityFollowUp("¿Y esa organizacion?", context(), progress).status).toBe("resolved");
    expect(resolveHoidTypedEntityFollowUp("¿Y esa organizacion secreta?", context(), progress).status)
      .toBe("unavailable");
  });
});

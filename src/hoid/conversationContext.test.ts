import { describe, expect, it } from "vitest";
import {
  createHoidConversationContext,
  resolveHoidConversationFollowUp,
} from "./conversationContext";

const scope = Object.freeze({ revision: 7, fingerprint: "a".repeat(64) });
const ids = Object.freeze(["entity.alpha", "entity.beta"]);

describe("Hoid spoiler-safe conversation context", () => {
  it("stores only entity IDs and the exact progress identity", () => {
    const context = createHoidConversationContext(ids, scope);
    expect(context).toEqual({
      schemaVersion: 1,
      kind: "relationship-follow-up",
      entityIds: ids,
      progressRevision: 7,
      progressFingerprint: "a".repeat(64),
    });
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("alias");
    expect(serialized).not.toContain("question");
    expect(serialized).not.toContain("summary");
  });

  it("rejects duplicate, malformed and oversized entity ID sets", () => {
    expect(createHoidConversationContext(["entity.alpha", "entity.alpha"], scope)).toBeNull();
    expect(createHoidConversationContext(["entity.alpha", "bad id"], scope)).toBeNull();
    expect(createHoidConversationContext(["a", "b", "c", "d", "e"], scope)).toBeNull();
  });

  it("rejects accessor-backed ID arrays without invoking getters", () => {
    let invoked = false;
    const hostile = ["entity.alpha", "entity.beta"];
    Object.defineProperty(hostile, "0", {
      enumerable: true,
      configurable: true,
      get() { invoked = true; return "entity.alpha"; },
    });
    expect(createHoidConversationContext(hostile, scope)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("reuses a prior pair for an explicit group-level follow-up", () => {
    const context = createHoidConversationContext(ids, scope);
    expect(resolveHoidConversationFollowUp("¿Y entre ellos?", context, scope)).toEqual({
      status: "resolved",
      entityIds: ids,
    });
    expect(resolveHoidConversationFollowUp("¿Y cómo se relacionan?", context, scope)).toEqual({
      status: "resolved",
      entityIds: ids,
    });
    expect(resolveHoidConversationFollowUp("¿Y el vínculo entre ellos?", context, scope)).toEqual({
      status: "resolved",
      entityIds: ids,
    });
  });

  it("rejects singular pronouns rather than guessing grammatical gender or identity", () => {
    const context = createHoidConversationContext(ids, scope);
    expect(resolveHoidConversationFollowUp("¿Y ella?", context, scope)).toEqual({
      status: "unavailable",
      reason: "ambiguous-reference",
    });
    expect(resolveHoidConversationFollowUp("¿Y él?", context, scope)).toEqual({
      status: "unavailable",
      reason: "ambiguous-reference",
    });
    expect(resolveHoidConversationFollowUp("¿Y qué sabes de él?", context, scope)).toEqual({
      status: "unavailable",
      reason: "ambiguous-reference",
    });
  });

  it("does not treat an unrelated question as a follow-up", () => {
    expect(resolveHoidConversationFollowUp(
      "¿Cómo funciona este sistema de magia?",
      createHoidConversationContext(ids, scope),
      scope,
    )).toEqual({ status: "not-follow-up" });
  });

  it("fails closed when a group follow-up has no prior relationship context", () => {
    expect(resolveHoidConversationFollowUp("¿Y entre ellos?", null, scope)).toEqual({
      status: "unavailable",
      reason: "missing-context",
    });
  });

  it("invalidates context when either progress revision or fingerprint changes", () => {
    const context = createHoidConversationContext(ids, scope);
    expect(resolveHoidConversationFollowUp(
      "¿Y entre ellos?",
      context,
      { revision: 8, fingerprint: "a".repeat(64) },
    )).toEqual({ status: "unavailable", reason: "stale-context" });
    expect(resolveHoidConversationFollowUp(
      "¿Y entre ellos?",
      context,
      { revision: 7, fingerprint: "b".repeat(64) },
    )).toEqual({ status: "unavailable", reason: "stale-context" });
  });

  it("rejects malformed contexts and invalid progress snapshots", () => {
    expect(resolveHoidConversationFollowUp(
      "¿Y entre ellos?",
      { ...createHoidConversationContext(ids, scope), extra: true },
      scope,
    )).toEqual({ status: "unavailable", reason: "invalid-context" });
    expect(resolveHoidConversationFollowUp(
      "¿Y entre ellos?",
      createHoidConversationContext(ids, scope),
      null,
    )).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });
});

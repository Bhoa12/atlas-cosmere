import { describe, expect, it } from "vitest";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
  canCommitHoidProgressScopedResponse,
  filterVisibleHoidMessages,
  isHoidConversationMessageVisible,
  isHoidConversationProgressScope,
  pruneStaleHoidMessages,
  sameHoidConversationProgressScope,
} from "./conversationHistoryPolicy";

const scopeA = Object.freeze({ revision: 4, fingerprint: "a".repeat(64) });
const scopeB = Object.freeze({ revision: 5, fingerprint: "b".repeat(64) });
const sameRevisionDifferentContent = Object.freeze({ revision: 4, fingerprint: "c".repeat(64) });

function userMessage(id = "user", texto = "Pregunta del lector") {
  return { id, emisor: "usuario" as const, texto };
}

function hoidMessage(id = "answer", scope: unknown = scopeA) {
  return { id, emisor: "hoid" as const, texto: "Respuesta autorizada", progressScope: scope };
}

function staticGreeting(texto = HOID_STATIC_GREETING_TEXT) {
  return {
    id: HOID_STATIC_GREETING_ID,
    emisor: "hoid" as const,
    kind: HOID_STATIC_GREETING_KIND,
    texto,
  };
}

describe("Hoid conversation history spoiler invalidation", () => {
  it("accepts only canonical progress scopes", () => {
    expect(isHoidConversationProgressScope(scopeA)).toBe(true);
    expect(isHoidConversationProgressScope({ revision: -1, fingerprint: "a".repeat(64) })).toBe(false);
    expect(isHoidConversationProgressScope({ revision: 4, fingerprint: "A".repeat(64) })).toBe(false);
    expect(isHoidConversationProgressScope({ revision: 4, fingerprint: "a".repeat(63) })).toBe(false);
    expect(isHoidConversationProgressScope({ ...scopeA, extra: true })).toBe(false);
  });

  it("rejects accessor-backed scopes without invoking getters", () => {
    let invoked = false;
    const hostile = Object.defineProperties({}, {
      revision: { enumerable: true, get: () => { invoked = true; return 4; } },
      fingerprint: { enumerable: true, value: "a".repeat(64) },
    });
    expect(isHoidConversationProgressScope(hostile)).toBe(false);
    expect(invoked).toBe(false);
  });

  it("compares revision and fingerprint", () => {
    expect(sameHoidConversationProgressScope(scopeA, { ...scopeA })).toBe(true);
    expect(sameHoidConversationProgressScope(scopeA, scopeB)).toBe(false);
    expect(sameHoidConversationProgressScope(scopeA, sameRevisionDifferentContent)).toBe(false);
  });

  it("keeps an answer only for the exact current scope", () => {
    expect(isHoidConversationMessageVisible(hoidMessage("a", scopeA), scopeA)).toBe(true);
    expect(isHoidConversationMessageVisible(hoidMessage("a", scopeA), scopeB)).toBe(false);
    expect(isHoidConversationMessageVisible(hoidMessage("a", scopeA), sameRevisionDifferentContent)).toBe(false);
  });

  it("hides scoped answers when progress is unavailable", () => {
    expect(isHoidConversationMessageVisible(hoidMessage("a", scopeA), null)).toBe(false);
  });

  it("preserves well-formed user messages and the exact static greeting", () => {
    expect(isHoidConversationMessageVisible(userMessage(), null)).toBe(true);
    expect(isHoidConversationMessageVisible(staticGreeting(), null)).toBe(true);
    expect(isHoidConversationMessageVisible(hoidMessage("a", scopeA), null)).toBe(false);
  });

  it("rejects a greeting marker whose text differs from the canonical text", () => {
    expect(isHoidConversationMessageVisible(staticGreeting("Texto narrativo no autorizado"), scopeA)).toBe(false);
    expect(isHoidConversationMessageVisible(staticGreeting("Texto narrativo no autorizado"), null)).toBe(false);
  });

  it("rejects extra properties on the unscoped greeting record", () => {
    expect(isHoidConversationMessageVisible({
      ...staticGreeting(),
      citations: [{ title: "future source", chapter: 99 }],
    }, null)).toBe(false);
  });

  it("does not invoke accessor-backed greeting text", () => {
    let invoked = false;
    const hostile = Object.defineProperties({
      id: HOID_STATIC_GREETING_ID,
      emisor: "hoid",
      kind: HOID_STATIC_GREETING_KIND,
    }, {
      texto: { enumerable: true, get: () => { invoked = true; return HOID_STATIC_GREETING_TEXT; } },
    });
    expect(isHoidConversationMessageVisible(hostile, null)).toBe(false);
    expect(invoked).toBe(false);
  });

  it("reserves the greeting identity and kind for the unscoped canonical record", () => {
    expect(isHoidConversationMessageVisible({
      id: HOID_STATIC_GREETING_ID,
      emisor: "hoid",
      texto: "Respuesta",
      progressScope: scopeA,
    }, scopeA)).toBe(false);
    expect(isHoidConversationMessageVisible({
      id: "answer",
      emisor: "hoid",
      kind: HOID_STATIC_GREETING_KIND,
      texto: "Respuesta",
      progressScope: scopeA,
    }, scopeA)).toBe(false);
  });

  it("collapses duplicate canonical greetings to one visible entry", () => {
    const result = filterVisibleHoidMessages([
      staticGreeting(),
      userMessage("user-2"),
      staticGreeting(),
    ], null);
    expect(result.map(message => message.id)).toEqual([HOID_STATIC_GREETING_ID, "user-2"]);
  });

  it("hides legacy unscoped assistant messages even when a current scope exists", () => {
    expect(isHoidConversationMessageVisible({
      id: "legacy-answer",
      emisor: "hoid",
      texto: "Texto antiguo",
    }, scopeA)).toBe(false);
    expect(isHoidConversationMessageVisible({
      id: "spoofed-greeting",
      emisor: "hoid",
      kind: HOID_STATIC_GREETING_KIND,
      texto: HOID_STATIC_GREETING_TEXT,
    }, scopeA)).toBe(false);
  });

  it("fails closed for a malformed present scope", () => {
    expect(isHoidConversationMessageVisible(
      { ...hoidMessage("bad", scopeA), progressScope: { revision: 4, fingerprint: "bad" } },
      scopeA,
    )).toBe(false);
  });

  it("rejects malformed records without stable IDs or bounded text", () => {
    expect(isHoidConversationMessageVisible({ emisor: "usuario", texto: "Pregunta" }, scopeA)).toBe(false);
    expect(isHoidConversationMessageVisible({ id: "answer", emisor: "hoid", progressScope: scopeA }, scopeA)).toBe(false);
    expect(isHoidConversationMessageVisible({
      id: "answer",
      emisor: "hoid",
      texto: "x".repeat(50_001),
      progressScope: scopeA,
    }, scopeA)).toBe(false);
  });

  it("rejects accessor-backed user text without invoking the getter", () => {
    let invoked = false;
    const hostile = Object.defineProperties({ id: "user", emisor: "usuario" }, {
      texto: { enumerable: true, get: () => { invoked = true; return "Pregunta"; } },
    });
    expect(isHoidConversationMessageVisible(hostile, null)).toBe(false);
    expect(invoked).toBe(false);
  });

  it("filters stale assistant messages before rendering", () => {
    const messages = [
      staticGreeting(),
      userMessage(),
      hoidMessage("old", scopeA),
      hoidMessage("current", scopeB),
    ];
    expect(filterVisibleHoidMessages(messages, scopeB).map(message => message.id))
      .toEqual([HOID_STATIC_GREETING_ID, "user", "current"]);
  });

  it("prunes stale answers without mutating the original history", () => {
    const messages = Object.freeze([
      Object.freeze(userMessage()),
      Object.freeze(hoidMessage("old", scopeA)),
      Object.freeze(hoidMessage("current", scopeB)),
    ]);
    const result = pruneStaleHoidMessages(messages, scopeB);
    expect(result.map(message => message.id)).toEqual(["user", "current"]);
    expect(messages).toHaveLength(3);
  });

  it("commits only when request, response and live scopes agree", () => {
    expect(canCommitHoidProgressScopedResponse(scopeA, scopeA, scopeA)).toBe(true);
    expect(canCommitHoidProgressScopedResponse(scopeA, scopeA, scopeB)).toBe(false);
    expect(canCommitHoidProgressScopedResponse(scopeA, scopeB, scopeB)).toBe(false);
    expect(canCommitHoidProgressScopedResponse(scopeA, scopeA, null)).toBe(false);
  });

  it("invalidates both forward and backward progress changes", () => {
    expect(canCommitHoidProgressScopedResponse(scopeA, scopeA, scopeB)).toBe(false);
    expect(canCommitHoidProgressScopedResponse(scopeB, scopeB, scopeA)).toBe(false);
  });

  it("rejects inherited message records", () => {
    const inherited = Object.create({ emisor: "hoid" });
    expect(isHoidConversationMessageVisible(inherited, scopeA)).toBe(false);
  });
});

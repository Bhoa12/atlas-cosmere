import { describe, expect, it } from "vitest";
import {
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
    expect(isHoidConversationMessageVisible({ emisor: "hoid", progressScope: scopeA }, scopeA)).toBe(true);
    expect(isHoidConversationMessageVisible({ emisor: "hoid", progressScope: scopeA }, scopeB)).toBe(false);
    expect(isHoidConversationMessageVisible({ emisor: "hoid", progressScope: scopeA }, sameRevisionDifferentContent)).toBe(false);
  });

  it("hides scoped answers when progress is unavailable", () => {
    expect(isHoidConversationMessageVisible({ emisor: "hoid", progressScope: scopeA }, null)).toBe(false);
  });

  it("preserves user messages and the unscoped static greeting", () => {
    expect(isHoidConversationMessageVisible({ emisor: "usuario" }, null)).toBe(true);
    expect(isHoidConversationMessageVisible({ emisor: "hoid" }, null)).toBe(true);
  });

  it("fails closed for a malformed present scope", () => {
    expect(isHoidConversationMessageVisible(
      { emisor: "hoid", progressScope: { revision: 4, fingerprint: "bad" } },
      scopeA,
    )).toBe(false);
  });

  it("filters stale assistant messages before rendering", () => {
    const messages = [
      { id: "greeting", emisor: "hoid" as const },
      { id: "user", emisor: "usuario" as const },
      { id: "old", emisor: "hoid" as const, progressScope: scopeA },
      { id: "current", emisor: "hoid" as const, progressScope: scopeB },
    ];
    expect(filterVisibleHoidMessages(messages, scopeB).map(message => message.id))
      .toEqual(["greeting", "user", "current"]);
  });

  it("prunes stale answers without mutating the original history", () => {
    const messages = Object.freeze([
      Object.freeze({ id: "user", emisor: "usuario" as const }),
      Object.freeze({ id: "old", emisor: "hoid" as const, progressScope: scopeA }),
      Object.freeze({ id: "current", emisor: "hoid" as const, progressScope: scopeB }),
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

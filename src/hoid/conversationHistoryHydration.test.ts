import { describe, expect, it } from "vitest";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import {
  HOID_CONVERSATION_HISTORY_KIND,
  HOID_CONVERSATION_HISTORY_SCHEMA_VERSION,
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";

const scopeA = Object.freeze({ revision: 21, fingerprint: "a".repeat(64) });
const scopeB = Object.freeze({ revision: 22, fingerprint: "b".repeat(64) });

function greeting() {
  return {
    id: HOID_STATIC_GREETING_ID,
    emisor: "hoid" as const,
    kind: HOID_STATIC_GREETING_KIND,
    texto: HOID_STATIC_GREETING_TEXT,
  };
}

function userMessage(id = "user-1", texto = "Pregunta del lector") {
  return { id, emisor: "usuario" as const, texto };
}

function assistantMessage(id = "answer-1", progressScope: unknown = scopeA) {
  return { id, emisor: "hoid" as const, texto: "Respuesta autorizada", progressScope };
}

function createSnapshot(messages: unknown = [greeting(), userMessage(), assistantMessage()]) {
  return createHoidConversationHistorySnapshot(messages, scopeA);
}

describe("versioned Hoid conversation history hydration", () => {
  it("creates an explicit v1 envelope without writing to persistence", () => {
    const result = createSnapshot();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.snapshot.schemaVersion).toBe(HOID_CONVERSATION_HISTORY_SCHEMA_VERSION);
    expect(result.snapshot.kind).toBe(HOID_CONVERSATION_HISTORY_KIND);
    expect(result.snapshot.progressScope).toEqual(scopeA);
    expect(result.snapshot.messages).toHaveLength(3);
  });

  it("hydrates the complete history only for the exact saved progress identity", () => {
    const created = createSnapshot();
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    const result = hydrateHoidConversationHistorySnapshot(created.snapshot, scopeA);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID,
      "user-1",
      "answer-1",
    ]);
    expect(result.droppedAssistantCount).toBe(0);
  });

  it("preserves user messages and greeting but drops assistant prose for stale progress", () => {
    const created = createSnapshot();
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    const result = hydrateHoidConversationHistorySnapshot(created.snapshot, scopeB);
    expect(result.status).toBe("stale");
    if (result.status !== "stale") return;
    expect(result.messages.map(message => message.id)).toEqual([HOID_STATIC_GREETING_ID, "user-1"]);
    expect(result.droppedAssistantCount).toBe(1);
  });

  it("fails closed for unavailable current progress while retaining user-authored history", () => {
    const created = createSnapshot();
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    const result = hydrateHoidConversationHistorySnapshot(created.snapshot, null);
    expect(result.status).toBe("stale");
    if (result.status !== "stale") return;
    expect(result.messages.map(message => message.id)).toEqual([HOID_STATIC_GREETING_ID, "user-1"]);
    expect(result.droppedAssistantCount).toBe(1);
  });

  it("rejects unsupported schema versions without a legacy fallback", () => {
    const created = createSnapshot();
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    const result = hydrateHoidConversationHistorySnapshot({
      ...created.snapshot,
      schemaVersion: 2,
    }, scopeA);
    expect(result).toEqual({ status: "invalid", reason: "unsupported-version" });
  });

  it("rejects envelope extension fields instead of silently accepting unknown data", () => {
    const created = createSnapshot();
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    const result = hydrateHoidConversationHistorySnapshot({
      ...created.snapshot,
      providerPayload: { answer: "unreviewed" },
    }, scopeA);
    expect(result).toEqual({ status: "invalid", reason: "invalid-envelope" });
  });

  it("rejects malformed saved progress identities", () => {
    const created = createSnapshot();
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    const result = hydrateHoidConversationHistorySnapshot({
      ...created.snapshot,
      progressScope: { revision: 21, fingerprint: "bad" },
    }, scopeA);
    expect(result).toEqual({ status: "invalid", reason: "invalid-progress" });
  });

  it("rejects duplicate message IDs atomically", () => {
    const result = createSnapshot([
      userMessage("same"),
      assistantMessage("same"),
    ]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("rejects duplicate canonical greetings", () => {
    const result = createSnapshot([greeting(), greeting()]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("rejects sparse message arrays", () => {
    const messages: unknown[] = [];
    messages.length = 2;
    messages[1] = userMessage();
    const result = createSnapshot(messages);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("rejects an assistant message bound to a different saved scope", () => {
    const result = createSnapshot([assistantMessage("stale", scopeB)]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("rejects assistant messages without a progress scope", () => {
    const result = createSnapshot([{
      id: "unscoped",
      emisor: "hoid",
      texto: "Texto antiguo",
    }]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("rejects accessor-backed message text without invoking the getter", () => {
    let invoked = false;
    const hostile = Object.defineProperties({ id: "hostile", emisor: "usuario" }, {
      texto: { enumerable: true, get: () => { invoked = true; return "Pregunta"; } },
    });
    const result = createSnapshot([hostile]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
    expect(invoked).toBe(false);
  });

  it("rejects citations and rich presentation fields in the v1 text-only schema", () => {
    const result = createSnapshot([{
      ...assistantMessage(),
      citations: [{ title: "unverified citation" }],
    }]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("rejects oversized individual messages and aggregate snapshots", () => {
    expect(createSnapshot([userMessage("large", "x".repeat(50_001))]))
      .toEqual({ status: "invalid", reason: "invalid-messages" });

    const aggregate = Array.from({ length: 6 }, (_, index) =>
      userMessage("user-" + index, "x".repeat(45_000)),
    );
    expect(createSnapshot(aggregate)).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("returns independent frozen records rather than caller-owned references", () => {
    const original = [userMessage(), assistantMessage()];
    const created = createSnapshot(original);
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    expect(Object.isFrozen(created.snapshot)).toBe(true);
    expect(Object.isFrozen(created.snapshot.messages)).toBe(true);
    expect(Object.isFrozen(created.snapshot.messages[0])).toBe(true);
    expect(created.snapshot.messages[0]).not.toBe(original[0]);
  });

  it("rejects inherited message records", () => {
    const inherited = Object.create({ texto: "Pregunta" });
    inherited.id = "inherited";
    inherited.emisor = "usuario";
    const result = createSnapshot([inherited]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("rejects non-canonical current assistant records rather than partially restoring them", () => {
    const result = createSnapshot([
      userMessage(),
      { ...assistantMessage(), extra: "unexpected" },
    ]);
    expect(result).toEqual({ status: "invalid", reason: "invalid-messages" });
  });

  it("allows an empty canonical history", () => {
    const created = createSnapshot([]);
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    expect(hydrateHoidConversationHistorySnapshot(created.snapshot, scopeA)).toMatchObject({
      status: "ready",
      messages: [],
      droppedAssistantCount: 0,
    });
  });
});

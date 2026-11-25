import { describe, expect, it, vi } from "vitest";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import {
  createHoidConversationHistorySnapshot,
  type HoidPersistableConversationMessage,
} from "./conversationHistoryHydration";
import {
  createHoidConversationVaultHistoryBridge,
} from "./conversationVaultHistoryBridge";
import {
  createHoidConversationVaultHistoryCodec,
} from "./conversationVaultHistoryCodec";
import type {
  HoidConversationVault,
  HoidConversationVaultResult,
} from "./conversationVault";

const SESSION = "hoid-screen:primary";
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

function userMessage(id = "user-1") {
  return { id, emisor: "usuario" as const, texto: "Pregunta del lector" };
}

function assistantMessage(id = "answer-1") {
  return {
    id,
    emisor: "hoid" as const,
    texto: "Respuesta autorizada para el progreso actual",
    progressScope: scopeA,
  };
}

function snapshot(messages: unknown = [greeting(), userMessage(), assistantMessage()]) {
  const result = createHoidConversationHistorySnapshot(messages, scopeA);
  if (result.status !== "ready") throw new Error("Invalid test history");
  return result.snapshot;
}

function fakeVault(initialSnapshot: unknown = null, initialRevision = 0) {
  let stored = initialSnapshot;
  let revision = initialRevision;
  const restore = vi.fn(async (): Promise<HoidConversationVaultResult> => (
    stored === null
      ? Object.freeze({ status: "empty", revision })
      : Object.freeze({ status: "ready", revision, snapshot: stored })
  ));
  const save = vi.fn(async (
    _sessionId: string,
    expectedRevision: number,
    next: unknown,
  ): Promise<HoidConversationVaultResult> => {
    if (expectedRevision !== revision) {
      return Object.freeze({ status: "conflict", revision });
    }
    revision += 1;
    stored = next;
    return Object.freeze({ status: "saved", revision });
  });
  const clear = vi.fn(async (
    _sessionId: string,
    expectedRevision: number,
  ): Promise<HoidConversationVaultResult> => {
    if (expectedRevision !== revision) {
      return Object.freeze({ status: "conflict", revision });
    }
    revision += 1;
    stored = null;
    return Object.freeze({ status: "cleared", revision });
  });
  const vault: HoidConversationVault = { restore, save, clear };
  return { vault, restore, save, clear, getStored: () => stored };
}

describe("Hoid encrypted conversation history bridge", () => {
  it("round-trips the existing allow-listed history schema through UTF-8 bytes", () => {
    const codec = createHoidConversationVaultHistoryCodec();
    const source = snapshot([
      greeting(),
      userMessage(),
      {
        ...assistantMessage(),
        texto: "Explicación con acentos: edición, capítulo y progresión.",
      },
    ]);
    const encoded = codec.encode(source);
    expect(encoded).toBeInstanceOf(Uint8Array);
    if (!encoded) return;
    const decoded = codec.decode(encoded);
    expect(decoded).toEqual(source);
  });

  it("rejects unknown envelope fields instead of persisting provider or trust data", () => {
    const codec = createHoidConversationVaultHistoryCodec();
    const source = snapshot();
    expect(codec.encode({
      ...source,
      providerPayload: { prompt: "private" },
      displayPermit: { token: "not-persistable" },
    })).toBeNull();
  });

  it("rejects citation and provider fields on individual messages", () => {
    const codec = createHoidConversationVaultHistoryCodec();
    const base = snapshot([userMessage()]);
    expect(codec.encode({
      ...base,
      messages: [
        userMessage(),
        {
          ...assistantMessage(),
          citations: [{ evidenceId: "not-persistable" }],
        },
      ],
    })).toBeNull();
    expect(codec.encode({
      ...base,
      messages: [
        userMessage(),
        {
          ...assistantMessage(),
          providerPayload: { raw: "not-persistable" },
        },
      ],
    })).toBeNull();
  });

  it("rejects invalid UTF-8 and oversized byte payloads", () => {
    const codec = createHoidConversationVaultHistoryCodec();
    expect(codec.decode(new Uint8Array([0xff, 0xfe, 0xfd]))).toBeNull();
    expect(codec.decode(new Uint8Array(1_750_001))).toBeNull();
  });

  it("does not mutate caller-owned bytes while decoding", () => {
    const codec = createHoidConversationVaultHistoryCodec();
    const encoded = codec.encode(snapshot());
    expect(encoded).not.toBeNull();
    if (!encoded) return;
    const before = new Uint8Array(encoded);
    codec.decode(encoded);
    expect(encoded).toEqual(before);
  });

  it("binds saves to the canonical progress-scoped history schema", async () => {
    const fixture = fakeVault();
    const bridge = createHoidConversationVaultHistoryBridge(fixture.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;

    await expect(bridge.save(0, [greeting(), userMessage(), assistantMessage()], scopeA))
      .resolves.toEqual({ status: "saved", revision: 1 });
    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(fixture.save).toHaveBeenCalledWith(SESSION, 0, expect.objectContaining({
      schemaVersion: 1,
      kind: "hoid-conversation-history",
      progressScope: scopeA,
    }));
  });

  it("rejects invalid history before calling the vault", async () => {
    const fixture = fakeVault();
    const bridge = createHoidConversationVaultHistoryBridge(fixture.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;

    await expect(bridge.save(0, [{
      id: "unscoped",
      emisor: "hoid",
      texto: "No debe persistirse",
    }], scopeA)).resolves.toEqual({
      status: "invalid-history",
      reason: "invalid-messages",
    });
    expect(fixture.save).not.toHaveBeenCalled();
  });

  it("restores assistant messages only when the live progress scope matches", async () => {
    const fixture = fakeVault(snapshot(), 4);
    const bridge = createHoidConversationVaultHistoryBridge(fixture.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;

    const result = await bridge.restore(scopeA);
    expect(result).toMatchObject({
      status: "ready",
      revision: 4,
      droppedAssistantCount: 0,
    });
    if (result.status !== "ready") return;
    expect(result.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID,
      "user-1",
      "answer-1",
    ]);
  });

  it("drops stale assistant prose before returning restored history", async () => {
    const fixture = fakeVault(snapshot(), 4);
    const bridge = createHoidConversationVaultHistoryBridge(fixture.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;

    const result = await bridge.restore(scopeB);
    expect(result).toMatchObject({
      status: "stale",
      revision: 4,
      droppedAssistantCount: 1,
    });
    if (result.status !== "stale") return;
    expect(result.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID,
      "user-1",
    ]);
    expect(result.messages.some(message => message.emisor === "hoid" && message.id === "answer-1"))
      .toBe(false);
  });

  it("retains only user-authored history when live progress is unavailable", async () => {
    const fixture = fakeVault(snapshot(), 4);
    const bridge = createHoidConversationVaultHistoryBridge(fixture.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;

    const result = await bridge.restore(null);
    expect(result.status).toBe("stale");
    if (result.status !== "stale") return;
    expect(result.messages.every(message =>
      message.emisor === "usuario" || message.id === HOID_STATIC_GREETING_ID
    )).toBe(true);
  });

  it("blocks malformed stored history instead of returning partially decoded prose", async () => {
    const fixture = fakeVault({ malformed: true }, 2);
    const bridge = createHoidConversationVaultHistoryBridge(fixture.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;

    await expect(bridge.restore(scopeA)).resolves.toEqual({
      status: "blocked",
      reason: "invalid-history-snapshot",
    });
  });

  it("propagates empty and vault-blocked states without fallback", async () => {
    const emptyFixture = fakeVault();
    const emptyBridge = createHoidConversationVaultHistoryBridge(emptyFixture.vault, SESSION);
    expect(emptyBridge).not.toBeNull();
    if (!emptyBridge) return;
    await expect(emptyBridge.restore(scopeA)).resolves.toEqual({ status: "empty", revision: 0 });

    const blockedVault: HoidConversationVault = {
      restore: async () => Object.freeze({ status: "blocked", reason: "checkpoint-unavailable" }),
      save: async () => Object.freeze({ status: "blocked", reason: "checkpoint-unavailable" }),
      clear: async () => Object.freeze({ status: "blocked", reason: "checkpoint-unavailable" }),
    };
    const blockedBridge = createHoidConversationVaultHistoryBridge(blockedVault, SESSION);
    expect(blockedBridge).not.toBeNull();
    if (!blockedBridge) return;
    await expect(blockedBridge.restore(scopeA)).resolves.toEqual({
      status: "blocked",
      reason: "checkpoint-unavailable",
    });
  });

  it("binds clear to the same session and expected vault revision", async () => {
    const fixture = fakeVault(snapshot(), 4);
    const bridge = createHoidConversationVaultHistoryBridge(fixture.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;

    await expect(bridge.clear(4)).resolves.toEqual({ status: "cleared", revision: 5 });
    expect(fixture.clear).toHaveBeenCalledWith(SESSION, 4);
  });

  it("rejects malformed session identifiers at construction", () => {
    const fixture = fakeVault();
    expect(createHoidConversationVaultHistoryBridge(fixture.vault, "../other-session")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  HOID_HISTORY_SNAPSHOT_CODEC_MAX_BYTES,
  createHoidConversationHistorySnapshotCodec,
} from "./conversationHistorySnapshotCodec";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import {
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";
import type { HoidConversationVaultCodec } from "./conversationVault";

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

function snapshot(messages: unknown = [
  greeting(),
  { id: "user-1", emisor: "usuario", texto: "¿Qué ocurre en Roshar? 🧭" },
  { id: "answer-1", emisor: "hoid", texto: "Respuesta ligada al progreso", progressScope: scopeA },
]) {
  const result = createHoidConversationHistorySnapshot(messages, scopeA);
  if (result.status !== "ready") throw new Error("Invalid test snapshot");
  return result.snapshot;
}

function utf8ForTest(value: string): Uint8Array {
  const encoded = encodeURIComponent(value).replace(/%([0-9A-F]{2})/gu, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)));
  return Uint8Array.from(encoded, character => character.charCodeAt(0));
}

describe("Hoid canonical conversation history snapshot codec", () => {
  it("implements the encrypted Vault codec contract", () => {
    const codec: HoidConversationVaultCodec = createHoidConversationHistorySnapshotCodec();
    expect(typeof codec.encode).toBe("function");
    expect(typeof codec.decode).toBe("function");
  });

  it("round-trips Spanish text and supplementary Unicode without changing the snapshot", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const original = snapshot();
    const bytes = codec.encode(original);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(codec.decode(bytes!)).toEqual(original);
  });

  it("produces a deterministic canonical encoding and digest", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const original = snapshot();
    const first = codec.encode(original);
    const second = codec.encode(codec.decode(first!)!);
    expect(Array.from(first!)).toEqual(Array.from(second!));
    expect(codec.digest(original)).toMatch(/^[a-f0-9]{64}$/u);
    expect(codec.digest(original)).toBe(codec.digest(codec.decode(first!)!));
  });

  it("changes the digest when canonical user content changes", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const left = snapshot([{ id: "user-1", emisor: "usuario", texto: "Pregunta A" }]);
    const right = snapshot([{ id: "user-1", emisor: "usuario", texto: "Pregunta B" }]);
    expect(codec.digest(left)).not.toBe(codec.digest(right));
  });

  it("returns an independent frozen canonical snapshot", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const decoded = codec.decode(codec.encode(snapshot())!);
    expect(decoded).not.toBeNull();
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen((decoded as { messages: unknown[] }).messages)).toBe(true);
  });

  it("keeps old assistant prose progress-scoped after a successful round trip", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const decoded = codec.decode(codec.encode(snapshot())!);
    const hydrated = hydrateHoidConversationHistorySnapshot(decoded, scopeB);
    expect(hydrated.status).toBe("stale");
    if (hydrated.status !== "stale") return;
    expect(hydrated.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID,
      "user-1",
    ]);
    expect(hydrated.droppedAssistantCount).toBe(1);
  });

  it("rejects unsupported snapshot versions", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const invalid = { ...snapshot(), schemaVersion: 2 };
    expect(codec.canonicalize(invalid)).toBeNull();
    expect(codec.encode(invalid)).toBeNull();
    expect(codec.digest(invalid)).toBeNull();
  });

  it("rejects provider payloads and unknown top-level fields", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    expect(codec.encode({ ...snapshot(), providerPayload: { raw: "secret" } })).toBeNull();
  });

  it("rejects citations and rich message extensions rather than silently dropping them", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const invalid = snapshot([{
      id: "answer-1",
      emisor: "hoid",
      texto: "Respuesta ligada al progreso",
      progressScope: scopeA,
      citations: [{ url: "https://example.invalid" }],
    }]);
    expect(codec.encode(invalid)).toBeNull();
  });

  it("rejects accessor-backed envelopes without invoking getters", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    let invoked = false;
    const hostile = Object.create(null);
    Object.defineProperties(hostile, {
      schemaVersion: { enumerable: true, value: 1 },
      kind: { enumerable: true, value: "hoid-conversation-history" },
      progressScope: { enumerable: true, get: () => { invoked = true; return scopeA; } },
      messages: { enumerable: true, value: [] },
    });
    expect(codec.encode(hostile)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects non-canonical JSON with whitespace or reordered keys", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const original = snapshot([{ id: "user-1", emisor: "usuario", texto: "Pregunta" }]);
    const reordered = JSON.stringify({
      kind: original.kind,
      schemaVersion: original.schemaVersion,
      progressScope: original.progressScope,
      messages: original.messages,
    });
    expect(codec.decode(utf8ForTest(" " + JSON.stringify(original)))).toBeNull();
    expect(codec.decode(utf8ForTest(reordered))).toBeNull();
  });

  it("rejects duplicate JSON keys after canonical re-serialization", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const json = JSON.stringify(snapshot([])).replace(
      '"schemaVersion":1',
      '"schemaVersion":1,"schemaVersion":1',
    );
    expect(codec.decode(utf8ForTest(json))).toBeNull();
  });

  it("rejects malformed UTF-8 sequences", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    for (const bytes of [
      [0xc0, 0xaf],
      [0xe2, 0x82],
      [0xed, 0xa0, 0x80],
      [0xf4, 0x90, 0x80, 0x80],
      [0x80],
    ]) {
      expect(codec.decode(new Uint8Array(bytes))).toBeNull();
    }
  });

  it("rejects empty and oversized payloads before parsing", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    expect(codec.decode(new Uint8Array())).toBeNull();
    expect(codec.decode(new Uint8Array(HOID_HISTORY_SNAPSHOT_CODEC_MAX_BYTES + 1))).toBeNull();
  });

  it("rejects malformed envelopes and sparse message arrays", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const malformed = utf8ForTest(JSON.stringify({
      schemaVersion: 1,
      kind: "hoid-conversation-history",
      progressScope: scopeA,
      messages: Object.assign([], { 1: { id: "user-1", emisor: "usuario", texto: "Pregunta" }, length: 2 }),
    }));
    expect(codec.decode(malformed)).toBeNull();
  });

  it("does not mutate caller-owned bytes or snapshots", () => {
    const codec = createHoidConversationHistorySnapshotCodec();
    const original = snapshot();
    const bytes = codec.encode(original)!;
    const before = Array.from(bytes);
    codec.decode(bytes);
    expect(Array.from(bytes)).toEqual(before);
    expect(original.messages).toHaveLength(3);
  });
});

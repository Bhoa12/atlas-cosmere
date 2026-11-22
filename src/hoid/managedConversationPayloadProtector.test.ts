import { describe, expect, it } from "vitest";
import {
  createManagedHoidConversationPayloadProtector,
  type HoidAeadCipherPort,
} from "./managedConversationPayloadProtector";
import type {
  HoidConversationKeyManagerPort,
  HoidConversationManagedKeyDescriptor,
} from "./conversationKeyManagement";
import type { HoidConversationPayloadProtectionContext } from "./expoSqliteConversationHistoryStore";

const principalId = "hlp1_" + "a".repeat(48);
const context: HoidConversationPayloadProtectionContext = Object.freeze({
  purpose: "hoid-conversation-history",
  schemaVersion: 1,
  principalId,
  conversationId: "conversation-01",
  storageRevision: 7,
});

function key(
  version = 1,
  state: "active" | "decrypt-only" = "active",
): HoidConversationManagedKeyDescriptor {
  return Object.freeze({
    schemaVersion: 1,
    kind: "hoid-conversation-managed-key",
    principalId,
    keyId: "hkey1_" + String(version).padStart(24, "a"),
    keyHandle: "hkref1_test-key-handle-" + String(version),
    keyVersion: version,
    algorithm: "AES-256-GCM" as const,
    state,
  });
}

function manager(overrides: Partial<HoidConversationKeyManagerPort> = {}): HoidConversationKeyManagerPort {
  return Object.freeze({
    ensureActiveKey: async (_principal: string) => key(),
    resolveForDecryption: async (_principal: string, keyId: string) =>
      keyId === key().keyId ? key() : null,
    rotateActiveKey: async (_principal: string, _expected: number) => "rotated",
    ...overrides,
  });
}

function cipher(overrides: Partial<HoidAeadCipherPort> = {}): HoidAeadCipherPort {
  return Object.freeze({
    seal: async (
      _plaintext: string,
      _handle: string,
      _algorithm: "AES-256-GCM" | "CHACHA20-POLY1305" | "XCHACHA20-POLY1305",
      _associatedData: string,
    ) => Object.freeze({
      nonce: "A".repeat(16),
      ciphertext: "B".repeat(22),
    }),
    open: async (
      _ciphertext: string,
      _nonce: string,
      _handle: string,
      _algorithm: "AES-256-GCM" | "CHACHA20-POLY1305" | "XCHACHA20-POLY1305",
      _associatedData: string,
    ) => "restored conversation payload",
    ...overrides,
  });
}

function create(
  managerPort: HoidConversationKeyManagerPort = manager(),
  cipherPort: HoidAeadCipherPort = cipher(),
) {
  return createManagedHoidConversationPayloadProtector(managerPort, cipherPort);
}

describe("Managed Hoid AEAD payload protector", () => {
  it("seals plaintext into a versioned envelope without embedding plaintext", async () => {
    const protector = create();
    const envelopeText = await protector.seal("private conversation", context);
    const envelope = JSON.parse(envelopeText) as Record<string, unknown>;
    expect(envelope.kind).toBe("hoid-managed-aead-envelope");
    expect(envelope.keyId).toBe(key().keyId);
    expect(envelopeText).not.toContain("private conversation");
  });

  it("binds principal, conversation, revision, key ID, version and algorithm as associated data", async () => {
    let aad = "";
    const protector = create(manager(), cipher({
      seal: async (
        _plaintext: string,
        _handle: string,
        _algorithm: "AES-256-GCM" | "CHACHA20-POLY1305" | "XCHACHA20-POLY1305",
        associatedData: string,
      ) => {
        aad = associatedData;
        return { nonce: "A".repeat(16), ciphertext: "B".repeat(22) };
      },
    }));
    await protector.seal("payload", context);
    const parsed = JSON.parse(aad) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      purpose: "hoid-conversation-history",
      schemaVersion: 1,
      principalId,
      conversationId: "conversation-01",
      storageRevision: 7,
      keyId: key().keyId,
      keyVersion: 1,
      algorithm: "AES-256-GCM",
    });
  });

  it("opens an authenticated envelope using its exact key reference", async () => {
    let openedHandle = "";
    const protector = create(manager(), cipher({
      open: async (
        _ciphertext: string,
        _nonce: string,
        handle: string,
        _algorithm: "AES-256-GCM" | "CHACHA20-POLY1305" | "XCHACHA20-POLY1305",
        _associatedData: string,
      ) => {
        openedHandle = handle;
        return "restored conversation payload";
      },
    }));
    const envelope = await protector.seal("private payload", context);
    await expect(protector.open(envelope, context)).resolves.toBe("restored conversation payload");
    expect(openedHandle).toBe(key().keyHandle);
  });

  it("allows a decrypt-only key for historical ciphertext", async () => {
    const previous = key(1, "decrypt-only");
    const envelope = JSON.stringify({
      schemaVersion: 1,
      kind: "hoid-managed-aead-envelope",
      keyId: previous.keyId,
      keyVersion: previous.keyVersion,
      algorithm: previous.algorithm,
      nonce: "A".repeat(16),
      ciphertext: "B".repeat(22),
    });
    const protector = create(
      manager({ resolveForDecryption: async (_principal: string, _keyId: string) => previous }),
      cipher(),
    );
    await expect(protector.open(envelope, context)).resolves.toBe("restored conversation payload");
  });

  it("rejects an envelope with extra fields", async () => {
    const envelope = JSON.stringify({
      schemaVersion: 1,
      kind: "hoid-managed-aead-envelope",
      keyId: key().keyId,
      keyVersion: 1,
      algorithm: "AES-256-GCM",
      nonce: "A".repeat(16),
      ciphertext: "B".repeat(22),
      fallback: "plaintext",
    });
    await expect(create().open(envelope, context)).rejects.toThrow();
  });

  it("rejects a key version or algorithm that differs from the envelope", async () => {
    const envelope = JSON.stringify({
      schemaVersion: 1,
      kind: "hoid-managed-aead-envelope",
      keyId: key().keyId,
      keyVersion: 2,
      algorithm: "AES-256-GCM",
      nonce: "A".repeat(16),
      ciphertext: "B".repeat(22),
    });
    await expect(create().open(envelope, context)).rejects.toThrow();
  });

  it("rejects a malformed nonce before calling the cipher", async () => {
    let invoked = false;
    const envelope = JSON.stringify({
      schemaVersion: 1,
      kind: "hoid-managed-aead-envelope",
      keyId: key().keyId,
      keyVersion: 1,
      algorithm: "AES-256-GCM",
      nonce: "short",
      ciphertext: "B".repeat(22),
    });
    const protector = create(manager(), cipher({
      open: async () => { invoked = true; return "payload"; },
    }));
    await expect(protector.open(envelope, context)).rejects.toThrow();
    expect(invoked).toBe(false);
  });

  it("rejects an invalid cipher port without invoking accessors", () => {
    let invoked = false;
    const hostile = Object.defineProperties({}, {
      seal: { enumerable: true, get: () => { invoked = true; return async () => ({ nonce: "A".repeat(16), ciphertext: "B".repeat(22) }); } },
      open: { enumerable: true, value: async () => "payload" },
    });
    expect(() => createManagedHoidConversationPayloadProtector(manager(), hostile)).toThrow(TypeError);
    expect(invoked).toBe(false);
  });

  it("rejects an envelope belonging to a different principal", async () => {
    const otherKey = Object.freeze({ ...key(), principalId: "hlp1_" + "b".repeat(48) });
    const envelope = JSON.stringify({
      schemaVersion: 1,
      kind: "hoid-managed-aead-envelope",
      keyId: otherKey.keyId,
      keyVersion: 1,
      algorithm: "AES-256-GCM",
      nonce: "A".repeat(16),
      ciphertext: "B".repeat(22),
    });
    await expect(create(
      manager({ resolveForDecryption: async (_principal: string, _keyId: string) => otherKey }),
      cipher(),
    ).open(envelope, context)).rejects.toThrow();
  });

  it("rejects missing keys without trying another key", async () => {
    let invoked = false;
    const protector = create(
      manager({ resolveForDecryption: async (_principal: string, _keyId: string) => null }),
      cipher({ open: async () => { invoked = true; return "payload"; } }),
    );
    const envelope = JSON.stringify({
      schemaVersion: 1,
      kind: "hoid-managed-aead-envelope",
      keyId: key().keyId,
      keyVersion: 1,
      algorithm: "AES-256-GCM",
      nonce: "A".repeat(16),
      ciphertext: "B".repeat(22),
    });
    await expect(protector.open(envelope, context)).rejects.toThrow();
    expect(invoked).toBe(false);
  });

  it("rejects malformed contexts before touching the key manager", async () => {
    let invoked = false;
    const protector = create(manager({
      ensureActiveKey: async (_principal: string) => { invoked = true; return key(); },
    }), cipher());
    await expect(protector.seal("payload", { ...context, storageRevision: 0 })).rejects.toThrow();
    expect(invoked).toBe(false);
  });

  it("rejects oversized plaintext before touching the cipher", async () => {
    let invoked = false;
    const protector = create(manager(), cipher({
      seal: async () => { invoked = true; return { nonce: "A".repeat(16), ciphertext: "B".repeat(22) }; },
    }));
    await expect(protector.seal("x".repeat(600_001), context)).rejects.toThrow();
    expect(invoked).toBe(false);
  });

  it("propagates authenticated decryption failures", async () => {
    const protector = create(manager(), cipher({
      open: async () => { throw new Error("authentication failed"); },
    }));
    const envelope = await protector.seal("payload", context);
    await expect(protector.open(envelope, context)).rejects.toThrow("authentication failed");
  });

  it("uses a 24-byte nonce for XChaCha20-Poly1305", async () => {
    const xchachaKey = Object.freeze({
      ...key(),
      algorithm: "XCHACHA20-POLY1305" as const,
    });
    const protector = create(
      manager({ ensureActiveKey: async (_principal: string) => xchachaKey }),
      cipher({
        seal: async () => ({
          nonce: "A".repeat(32),
          ciphertext: "B".repeat(22),
        }),
      }),
    );
    const envelope = JSON.parse(await protector.seal("payload", context)) as Record<string, unknown>;
    expect(envelope.nonce).toBe("A".repeat(32));
    expect(envelope.algorithm).toBe("XCHACHA20-POLY1305");
  });
});

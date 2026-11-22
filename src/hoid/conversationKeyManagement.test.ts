import { describe, expect, it } from "vitest";
import {
  ensureHoidConversationActiveKey,
  resolveHoidConversationKeyForDecryption,
  rotateHoidConversationActiveKey,
  type HoidConversationKeyManagerPort,
  type HoidConversationManagedKeyDescriptor,
} from "./conversationKeyManagement";

const principalId = "hlp1_" + "a".repeat(48);

function descriptor(
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
    ensureActiveKey: async (_principalId: string) => descriptor(),
    resolveForDecryption: async (_principal: string, keyId: string) =>
      keyId === descriptor().keyId ? descriptor() : null,
    rotateActiveKey: async (_principal: string, _expected: number) => "rotated",
    ...overrides,
  });
}

describe("Hoid conversation key lifecycle boundary", () => {
  it("accepts an active key descriptor without exposing key bytes", async () => {
    const result = await ensureHoidConversationActiveKey(manager(), principalId);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.descriptor.keyHandle).toMatch(/^hkref1_/u);
      expect(result.descriptor.state).toBe("active");
      expect(result.descriptor).not.toHaveProperty("keyBytes");
    }
  });

  it("rejects an identity that does not match the requested principal", async () => {
    const result = await ensureHoidConversationActiveKey(
      manager({ ensureActiveKey: async (_principal: string) => ({ ...descriptor(), principalId: "hlp1_" + "b".repeat(48) }) }),
      principalId,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("rejects a decrypt-only key as the active encryption key", async () => {
    const result = await ensureHoidConversationActiveKey(
      manager({ ensureActiveKey: async (_principal: string) => descriptor(1, "decrypt-only") }),
      principalId,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("rejects manager accessors without invoking getters", async () => {
    let invoked = false;
    const hostile = Object.defineProperties({}, {
      ensureActiveKey: { enumerable: true, get: () => { invoked = true; return async () => descriptor(); } },
      resolveForDecryption: { enumerable: true, value: async () => descriptor() },
      rotateActiveKey: { enumerable: true, value: async () => "rotated" },
    });
    const result = await ensureHoidConversationActiveKey(hostile, principalId);
    expect(result).toEqual({ status: "invalid-input", reason: "invalid-manager" });
    expect(invoked).toBe(false);
  });

  it("rejects descriptors with extra properties", async () => {
    const result = await ensureHoidConversationActiveKey(
      manager({ ensureActiveKey: async (_principal: string) => ({ ...descriptor(), secret: "raw-key" }) }),
      principalId,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("rejects malformed key handles", async () => {
    const result = await ensureHoidConversationActiveKey(
      manager({ ensureActiveKey: async (_principal: string) => ({ ...descriptor(), keyHandle: "raw-key-material" }) }),
      principalId,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("resolves a previous decrypt-only key for reads", async () => {
    const previous = descriptor(1, "decrypt-only");
    const result = await resolveHoidConversationKeyForDecryption(
      manager({ resolveForDecryption: async (_principal: string, _keyId: string) => previous }),
      principalId,
      previous.keyId,
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.descriptor.state).toBe("decrypt-only");
  });

  it("rejects a descriptor returned for a different key ID", async () => {
    const result = await resolveHoidConversationKeyForDecryption(
      manager({ resolveForDecryption: async (_principal: string, _keyId: string) => descriptor(2) }),
      principalId,
      descriptor(1).keyId,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("fails closed when a key is absent from the vault", async () => {
    const result = await resolveHoidConversationKeyForDecryption(
      manager({ resolveForDecryption: async (_principal: string, _keyId: string) => null }),
      principalId,
      descriptor().keyId,
    );
    expect(result).toEqual({ status: "unavailable" });
  });

  it("rejects revoked or unknown key states", async () => {
    const result = await resolveHoidConversationKeyForDecryption(
      manager({ resolveForDecryption: async (_principal: string, _keyId: string) => ({ ...descriptor(), state: "revoked" }) }),
      principalId,
      descriptor().keyId,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("rotates to the next version and verifies that the previous key remains decrypt-only", async () => {
    let reads = 0;
    const result = await rotateHoidConversationActiveKey(
      manager({
        rotateActiveKey: async (_principal: string, expected: number) => expected === 1 ? "rotated" : "conflict",
        ensureActiveKey: async (_principal: string) => {
          reads += 1;
          return reads === 1 ? descriptor(1) : descriptor(2);
        },
        resolveForDecryption: async (_principal: string, keyId: string) =>
          keyId === descriptor(1).keyId ? descriptor(1, "decrypt-only") : descriptor(2),
      }),
      principalId,
      1,
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.descriptor.keyVersion).toBe(2);
  });

  it("rejects rotation when the new generation reuses the previous key ID", async () => {
    const previous = descriptor(1);
    const next = Object.freeze({ ...descriptor(2), keyId: previous.keyId });
    let resolveCalled = false;
    let reads = 0;
    const result = await rotateHoidConversationActiveKey(
      manager({
        rotateActiveKey: async () => "rotated",
        ensureActiveKey: async (_principal: string) => {
          reads += 1;
          return reads === 1 ? previous : next;
        },
        resolveForDecryption: async () => {
          resolveCalled = true;
          return descriptor(1, "decrypt-only");
        },
      }),
      principalId,
      1,
    );
    expect(result).toEqual({ status: "invalid-key" });
    expect(resolveCalled).toBe(false);
  });

  it("rejects rotation when the new generation reuses the previous key handle", async () => {
    const previous = descriptor(1);
    const next = Object.freeze({ ...descriptor(2), keyHandle: previous.keyHandle });
    let reads = 0;
    const result = await rotateHoidConversationActiveKey(
      manager({
        rotateActiveKey: async () => "rotated",
        ensureActiveKey: async (_principal: string) => {
          reads += 1;
          return reads === 1 ? previous : next;
        },
        resolveForDecryption: async () => descriptor(1, "decrypt-only"),
      }),
      principalId,
      1,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("rejects a stale expected version before asking the manager to rotate", async () => {
    let rotated = false;
    const result = await rotateHoidConversationActiveKey(
      manager({
        ensureActiveKey: async (_principal: string) => descriptor(2),
        rotateActiveKey: async () => { rotated = true; return "rotated"; },
      }),
      principalId,
      1,
    );
    expect(result).toEqual({ status: "conflict" });
    expect(rotated).toBe(false);
  });

  it("rejects rotation when the previous key is not retained decrypt-only", async () => {
    let reads = 0;
    const result = await rotateHoidConversationActiveKey(
      manager({
        rotateActiveKey: async () => "rotated",
        ensureActiveKey: async (_principal: string) => {
          reads += 1;
          return reads === 1 ? descriptor(1) : descriptor(2);
        },
        resolveForDecryption: async (_principal: string, _keyId: string) => descriptor(1, "active"),
      }),
      principalId,
      1,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("preserves a compare-and-swap conflict during rotation", async () => {
    const result = await rotateHoidConversationActiveKey(
      manager({ rotateActiveKey: async () => "conflict" }),
      principalId,
      1,
    );
    expect(result).toEqual({ status: "conflict" });
  });

  it("rejects a rotation that reports success without advancing the key version", async () => {
    const result = await rotateHoidConversationActiveKey(
      manager({ rotateActiveKey: async () => "rotated", ensureActiveKey: async (_principal: string) => descriptor(1) }),
      principalId,
      1,
    );
    expect(result).toEqual({ status: "invalid-key" });
  });

  it("rejects invalid principals, key IDs and versions before invoking the manager", async () => {
    const source = manager();
    expect(await ensureHoidConversationActiveKey(source, "profile-1"))
      .toEqual({ status: "invalid-input", reason: "invalid-principal" });
    expect(await resolveHoidConversationKeyForDecryption(source, principalId, "bad"))
      .toEqual({ status: "invalid-input", reason: "invalid-key-id" });
    expect(await rotateHoidConversationActiveKey(source, principalId, 0))
      .toEqual({ status: "invalid-input", reason: "invalid-key-version" });
  });

  it("maps vault failures to unavailable", async () => {
    const result = await ensureHoidConversationActiveKey(
      manager({ ensureActiveKey: async (_principal: string) => { throw new Error("keystore locked"); } }),
      principalId,
    );
    expect(result).toEqual({ status: "unavailable" });
  });
});

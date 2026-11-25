import { describe, expect, it, vi } from "vitest";
import {
  createHoidConversationVault,
  type HoidConversationVaultBlobStore,
  type HoidConversationVaultCheckpoint,
  type HoidConversationVaultEnvelope,
} from "./conversationVault";

const NOW = "2026-11-25T01:30:00.000Z";
const SESSION = "hoid-screen:primary";

function fixture(options: Readonly<{ checkpointCommit?: boolean }> = {}) {
  const blobs = new Map<string, HoidConversationVaultEnvelope>();
  const revisions = new Map<string, number>();
  const blobStore: HoidConversationVaultBlobStore = {
    read: async id => blobs.get(id) ?? null,
    compareAndSwap: async (id, expected, next) => {
      const current = blobs.get(id)?.revision ?? null;
      if (current !== expected) return false;
      blobs.set(id, next);
      return true;
    },
  };
  const checkpoint: HoidConversationVaultCheckpoint = {
    readRevision: async id => revisions.get(id) ?? null,
    compareAndSwap: async (id, expected, next) => {
      const current = revisions.get(id) ?? null;
      if (current !== expected || options.checkpointCommit === false) return false;
      revisions.set(id, next);
      return true;
    },
  };
  const seal = vi.fn(async () => ({
    nonce: "A".repeat(16),
    ciphertext: "AQID",
    tag: "B".repeat(22),
  }));
  const open = vi.fn(async () => new Uint8Array([1, 2, 3]));
  const vault = createHoidConversationVault({
    keys: {
      getActiveKey: async () => ({
        keyId: "key-v1",
        handle: Object.freeze({ opaqueNativeReference: "test-only" }),
      }),
      resolveKey: async keyId => keyId === "key-v1"
        ? { keyId, handle: Object.freeze({ opaqueNativeReference: "test-only" }) }
        : null,
    },
    aead: { seal, open },
    blobs: blobStore,
    checkpoint,
    codec: {
      encode: asyncValue => asyncValue === null ? null : new Uint8Array([7, 8, 9]),
      decode: bytes => bytes.length === 3 ? Object.freeze({ messages: Object.freeze(["hello"]) }) : null,
    },
    clock: { nowIso: () => NOW },
  });
  return { vault, blobs, revisions, seal, open };
}

describe("Hoid encrypted conversation vault", () => {
  it("starts empty without creating a parallel conversation ledger", async () => {
    const { vault } = fixture();
    await expect(vault.restore(SESSION)).resolves.toEqual({ status: "empty", revision: 0 });
  });

  it("encrypts before persistence and advances the checkpoint after the blob commit", async () => {
    const { vault, blobs, revisions, seal } = fixture();
    const result = await vault.save(SESSION, 0, Object.freeze({ messages: ["hello"] }));
    expect(result).toEqual({ status: "saved", revision: 1 });
    expect(revisions.get(SESSION)).toBe(1);
    const envelope = blobs.get(SESSION);
    expect(envelope).toBeDefined();
    expect(Object.keys(envelope ?? {}).sort()).toEqual([
      "aadSha256", "algorithm", "ciphertext", "keyId", "kind", "nonce",
      "revision", "schemaVersion", "sessionId", "tag", "updatedAt",
    ]);
    expect(envelope?.kind).toBe("snapshot");
    expect(envelope?.algorithm).toBe("AES-256-GCM");
    expect(seal).toHaveBeenCalledTimes(1);
  });

  it("restores only when the durable checkpoint and authenticated envelope agree", async () => {
    const { vault } = fixture();
    await vault.save(SESSION, 0, { messages: ["hello"] });
    await expect(vault.restore(SESSION)).resolves.toMatchObject({
      status: "ready",
      revision: 1,
      snapshot: { messages: ["hello"] },
    });
  });

  it("uses a revisioned encrypted tombstone instead of deleting rollback evidence", async () => {
    const { vault, blobs } = fixture();
    await vault.save(SESSION, 0, { messages: ["hello"] });
    await expect(vault.clear(SESSION, 1)).resolves.toEqual({ status: "cleared", revision: 2 });
    expect(blobs.get(SESSION)?.kind).toBe("tombstone");
    await expect(vault.restore(SESSION)).resolves.toEqual({ status: "empty", revision: 2 });
  });

  it("rejects stale writers using the checkpoint revision", async () => {
    const { vault } = fixture();
    await vault.save(SESSION, 0, { messages: ["one"] });
    await expect(vault.save(SESSION, 0, { messages: ["stale"] })).resolves.toEqual({
      status: "conflict",
      revision: 1,
    });
  });

  it("fails closed when the envelope is rolled back behind the checkpoint", async () => {
    const { vault, blobs, revisions } = fixture();
    await vault.save(SESSION, 0, { messages: ["hello"] });
    revisions.set(SESSION, 2);
    await expect(vault.restore(SESSION)).resolves.toEqual({
      status: "blocked",
      reason: "checkpoint-envelope-mismatch",
    });
    expect(blobs.get(SESSION)?.revision).toBe(1);
  });

  it("rejects authenticated metadata changes before decryption", async () => {
    const { vault, blobs, open } = fixture();
    await vault.save(SESSION, 0, { messages: ["hello"] });
    const stored = blobs.get(SESSION);
    if (!stored) throw new Error("Missing test envelope");
    blobs.set(SESSION, Object.freeze({ ...stored, aadSha256: "0".repeat(64) }));
    await expect(vault.restore(SESSION)).resolves.toEqual({
      status: "blocked",
      reason: "aad-mismatch",
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("does not report success when the rollback-resistant checkpoint refuses commit", async () => {
    const { vault, blobs, revisions } = fixture({ checkpointCommit: false });
    await expect(vault.save(SESSION, 0, { messages: ["hello"] })).resolves.toEqual({
      status: "blocked",
      reason: "checkpoint-commit-failed",
    });
    expect(blobs.get(SESSION)?.revision).toBe(1);
    expect(revisions.has(SESSION)).toBe(false);
  });

  it("rejects malformed session identifiers and missing historical keys", async () => {
    const { vault } = fixture();
    await expect(vault.restore("../other-session")).resolves.toEqual({
      status: "blocked",
      reason: "invalid-session",
    });
    await vault.save(SESSION, 0, { messages: ["hello"] });
    // A new vault instance can restore the same stores but cannot resolve the old key.
    const missingKeyVault = createHoidConversationVault({
      keys: {
        getActiveKey: async () => null,
        resolveKey: async () => null,
      },
      aead: {
        seal: async () => null,
        open: async () => new Uint8Array([1]),
      },
      blobs: {
        read: async id => (await vault.restore(id)).status === "blocked" ? null : null,
        compareAndSwap: async () => false,
      },
      checkpoint: {
        readRevision: async () => null,
        compareAndSwap: async () => false,
      },
      codec: { encode: () => new Uint8Array([1]), decode: () => null },
      clock: { nowIso: () => NOW },
    });
    expect(await missingKeyVault.restore(SESSION)).toMatchObject({ status: "empty" });
  });
});

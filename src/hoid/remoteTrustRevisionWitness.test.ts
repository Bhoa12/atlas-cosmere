import { describe, expect, it, vi } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import {
  buildHoidReviewerTrustRegistrySigningMessage,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";
import { persistHoidTrustRegistryMinimumRevision } from "./trustRegistryRevisionStore";
import {
  buildHoidTrustRevisionWitnessReceiptSigningMessage,
  createHoidRemoteTrustRegistryRevisionStorePort,
  type HoidTrustRevisionWitnessCompareAndSetRequest,
  type HoidTrustRevisionWitnessConfiguration,
  type HoidTrustRevisionWitnessReadRequest,
  type HoidTrustRevisionWitnessReceiptUnsigned,
} from "./remoteTrustRevisionWitness";

const NOW = "2026-11-19T13:00:00.000Z";
const WITNESS_ID = "atlas-revision-witness";
const KEY_ID = "atlas-witness-key-2026";
const DOMAIN = "atlas-cosmere-production";
const SEED = new Uint8Array(32).fill(7);

function hex(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

const publicKeyHex = hex(ed25519.getPublicKey(SEED));
const configuration: HoidTrustRevisionWitnessConfiguration = Object.freeze({
  witnessId: WITNESS_ID,
  keyId: KEY_ID,
  publicKeyHex,
  trustDomainId: DOMAIN,
});

function signReceipt(
  receipt: HoidTrustRevisionWitnessReceiptUnsigned,
  seed: Uint8Array = SEED,
): Readonly<HoidTrustRevisionWitnessReceiptUnsigned & { signatureHex: string }> {
  const message = buildHoidTrustRevisionWitnessReceiptSigningMessage(receipt);
  if (!message) throw new Error("Invalid test receipt");
  return Object.freeze({
    ...receipt,
    signatureHex: hex(ed25519.sign(new TextEncoder().encode(message), seed)),
  });
}

function readReceipt(
  request: HoidTrustRevisionWitnessReadRequest,
  overrides: Partial<HoidTrustRevisionWitnessReceiptUnsigned> = {},
) {
  return signReceipt({
    schemaVersion: 1,
    witnessId: request.witnessId,
    keyId: KEY_ID,
    trustDomainId: request.trustDomainId,
    operation: request.operation,
    requestNonceHex: request.requestNonceHex,
    expectedRevision: null,
    nextRevision: null,
    outcome: "read",
    observedRevision: 7,
    issuedAt: NOW,
    expiresAt: "2026-11-19T13:00:30.000Z",
    ...overrides,
  });
}

function casReceipt(
  request: HoidTrustRevisionWitnessCompareAndSetRequest,
  outcome: "advanced" | "already-applied" | "conflict" = "advanced",
  observedRevision = request.nextRevision,
  overrides: Partial<HoidTrustRevisionWitnessReceiptUnsigned> = {},
) {
  return signReceipt({
    schemaVersion: 1,
    witnessId: request.witnessId,
    keyId: KEY_ID,
    trustDomainId: request.trustDomainId,
    operation: request.operation,
    requestNonceHex: request.requestNonceHex,
    expectedRevision: request.expectedRevision,
    nextRevision: request.nextRevision,
    outcome,
    observedRevision,
    issuedAt: NOW,
    expiresAt: "2026-11-19T13:00:30.000Z",
    ...overrides,
  });
}

function nonceSequence() {
  let counter = 0;
  return {
    createNonceHex: vi.fn(async () => {
      counter += 1;
      return counter.toString(16).padStart(64, "0");
    }),
  };
}

function makeStore(overrides: {
  read?: (request: HoidTrustRevisionWitnessReadRequest) => Promise<unknown>;
  compare?: (request: HoidTrustRevisionWitnessCompareAndSetRequest) => Promise<unknown>;
  noncePort?: { createNonceHex(): Promise<unknown> };
  clock?: { now(): string };
} = {}) {
  const transport = {
    readMinimumRevision: vi.fn(async (request: HoidTrustRevisionWitnessReadRequest) =>
      overrides.read ? overrides.read(request) : readReceipt(request)),
    compareAndSetMinimumRevision: vi.fn(async (request: HoidTrustRevisionWitnessCompareAndSetRequest) =>
      overrides.compare ? overrides.compare(request) : casReceipt(request)),
  };
  const noncePort = overrides.noncePort ?? nonceSequence();
  const clock = overrides.clock ?? { now: () => NOW };
  const verifier = createHoidNobleEd25519VerificationPort();
  const port = createHoidRemoteTrustRegistryRevisionStorePort({
    configuration,
    transport,
    noncePort,
    clock,
    verifier,
  });
  return { port, transport, noncePort };
}

describe("Hoid signed remote monotonic trust revision witness", () => {
  it("reads a revision only from a fresh, nonce-bound, witness-signed receipt", async () => {
    const { port, transport } = makeStore();
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).resolves.toBe(7);
    expect(transport.readMinimumRevision).toHaveBeenCalledTimes(1);
    expect(transport.readMinimumRevision.mock.calls[0][0]).toMatchObject({
      schemaVersion: 1,
      operation: "read-minimum-revision",
      witnessId: WITNESS_ID,
      trustDomainId: DOMAIN,
      requestNonceHex: "0".repeat(63) + "1",
    });
  });

  it("maps an authenticated CAS advance to true", async () => {
    const { port, transport } = makeStore();
    await expect(port.compareAndSetMinimumRevision({
      trustDomainId: DOMAIN,
      expectedRevision: 7,
      nextRevision: 8,
    })).resolves.toBe(true);
    expect(transport.compareAndSetMinimumRevision).toHaveBeenCalledTimes(1);
  });

  it("maps an authenticated newer-revision conflict to false for caller re-read", async () => {
    const { port } = makeStore({
      compare: async request => casReceipt(request, "conflict", 9),
    });
    await expect(port.compareAndSetMinimumRevision({
      trustDomainId: DOMAIN,
      expectedRevision: 7,
      nextRevision: 8,
    })).resolves.toBe(false);
  });

  it("accepts an idempotent already-applied result only when the witness reports the target revision", async () => {
    const { port } = makeStore({
      compare: async request => casReceipt(request, "already-applied", request.nextRevision),
    });
    await expect(port.compareAndSetMinimumRevision({
      trustDomainId: DOMAIN,
      expectedRevision: 7,
      nextRevision: 8,
    })).resolves.toBe(true);
  });

  it("rejects a receipt replayed against a different request nonce", async () => {
    const { port } = makeStore({
      read: async request => readReceipt(request, {
        requestNonceHex: "f".repeat(64),
      }),
    });
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow();
  });

  it("rejects a mathematically valid receipt signed by an unpinned witness key", async () => {
    const wrongSeed = new Uint8Array(32).fill(9);
    const { port } = makeStore({
      read: async request => {
        const { signatureHex: _ignored, ...unsigned } = readReceipt(request);
        return signReceipt(unsigned, wrongSeed);
      },
    });
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow();
  });

  it("rejects expired receipts and receipts with excessive validity windows", async () => {
    const expired = makeStore({
      read: async request => readReceipt(request, {
        issuedAt: "2026-11-19T12:58:00.000Z",
        expiresAt: "2026-11-19T12:59:00.000Z",
      }),
    });
    await expect(expired.port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow();

    const overlong = makeStore({
      read: async request => readReceipt(request, {
        expiresAt: "2026-11-19T13:02:00.000Z",
      }),
    });
    await expect(overlong.port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow();
  });

  it("rejects a witness claiming a revision rollback in a CAS conflict", async () => {
    const { port } = makeStore({
      compare: async request => casReceipt(request, "conflict", request.expectedRevision - 1),
    });
    await expect(port.compareAndSetMinimumRevision({
      trustDomainId: DOMAIN,
      expectedRevision: 7,
      nextRevision: 8,
    })).rejects.toThrow();
  });

  it("rejects a successful CAS receipt whose observed revision differs from the target", async () => {
    const { port } = makeStore({
      compare: async request => casReceipt(request, "advanced", request.nextRevision + 1),
    });
    await expect(port.compareAndSetMinimumRevision({
      trustDomainId: DOMAIN,
      expectedRevision: 7,
      nextRevision: 8,
    })).rejects.toThrow();
  });

  it("rejects reused CSPRNG nonces before making a second transport request", async () => {
    const noncePort = { createNonceHex: vi.fn(async () => "a".repeat(64)) };
    const { port, transport } = makeStore({ noncePort });
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).resolves.toBe(7);
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow();
    expect(transport.readMinimumRevision).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid nonce and never calls the transport", async () => {
    const noncePort = { createNonceHex: vi.fn(async () => "not-random") };
    const { port, transport } = makeStore({ noncePort });
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow();
    expect(transport.readMinimumRevision).not.toHaveBeenCalled();
  });

  it("rejects cross-domain reads and malformed compare-and-set requests", async () => {
    const { port, transport } = makeStore();
    await expect(port.readMinimumRevision({ trustDomainId: "another-domain" })).rejects.toThrow();
    await expect(port.compareAndSetMinimumRevision({
      trustDomainId: DOMAIN,
      expectedRevision: 8,
      nextRevision: 8,
    })).rejects.toThrow();
    expect(transport.readMinimumRevision).not.toHaveBeenCalled();
    expect(transport.compareAndSetMinimumRevision).not.toHaveBeenCalled();
  });

  it("does not invoke accessors on untrusted receipt objects", async () => {
    let invoked = false;
    const { port } = makeStore({
      read: async request => {
        const valid = readReceipt(request);
        const hostile = Object.create(null) as Record<string, unknown>;
        for (const [key, value] of Object.entries(valid)) {
          Object.defineProperty(hostile, key, {
            enumerable: true,
            ...(key === "signatureHex"
              ? { get() { invoked = true; return value; } }
              : { value }),
          });
        }
        return hostile;
      },
    });
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow();
    expect(invoked).toBe(false);
  });

  it("rejects malformed signing-message objects and unexpected fields", () => {
    const valid = {
      schemaVersion: 1,
      witnessId: WITNESS_ID,
      keyId: KEY_ID,
      trustDomainId: DOMAIN,
      operation: "read-minimum-revision",
      requestNonceHex: "1".repeat(64),
      expectedRevision: null,
      nextRevision: null,
      outcome: "read",
      observedRevision: 7,
      issuedAt: NOW,
      expiresAt: "2026-11-19T13:00:30.000Z",
    };
    expect(buildHoidTrustRevisionWitnessReceiptSigningMessage(valid)).not.toBeNull();
    expect(buildHoidTrustRevisionWitnessReceiptSigningMessage({
      ...valid,
      extra: true,
    })).toBeNull();
  });


  it("composes with the existing monotonic coordinator using a separately signed registry and witness", async () => {
    const rootSeed = new Uint8Array(32).fill(11);
    const reviewerSeed = new Uint8Array(32).fill(13);
    const rootKey: HoidReviewerTrustRootKey = {
      keyId: "editorial-root",
      publicKeyHex: hex(ed25519.getPublicKey(rootSeed)),
    };
    const unsignedRegistry = {
      schemaVersion: 1 as const,
      revision: 2,
      issuedAt: "2026-11-19T12:00:00.000Z",
      expiresAt: "2026-11-20T00:00:00.000Z",
      keys: [{
        keyId: "reviewer-key",
        reviewerId: "reviewer-one",
        algorithm: "Ed25519" as const,
        publicKeyHex: hex(ed25519.getPublicKey(reviewerSeed)),
        status: "active" as const,
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: "2027-01-01T00:00:00.000Z",
        revokedAt: null,
        allowedRepositoryFullNames: ["Bhoa12/atlas-cosmere"],
      }],
    };
    const registryMessage = buildHoidReviewerTrustRegistrySigningMessage(unsignedRegistry);
    if (!registryMessage) throw new Error("Invalid signed-registry fixture");
    const registry: HoidReviewerTrustRegistry = {
      ...unsignedRegistry,
      rootSignature: {
        algorithm: "Ed25519",
        keyId: rootKey.keyId,
        signatureHex: hex(ed25519.sign(new TextEncoder().encode(registryMessage), rootSeed)),
      },
    };

    let minimumRevision = 1;
    const store = makeStore({
      read: async request => readReceipt(request, { observedRevision: minimumRevision }),
      compare: async request => {
        if (minimumRevision === request.expectedRevision) {
          minimumRevision = request.nextRevision;
          return casReceipt(request, "advanced", minimumRevision);
        }
        if (minimumRevision === request.nextRevision) {
          return casReceipt(request, "already-applied", minimumRevision);
        }
        return casReceipt(request, "conflict", minimumRevision);
      },
    });

    const result = await persistHoidTrustRegistryMinimumRevision(
      registry,
      rootKey,
      createHoidNobleEd25519VerificationPort(),
      NOW,
      DOMAIN,
      store.port,
    );
    expect(result).toMatchObject({
      status: "persisted",
      trustDomainId: DOMAIN,
      registryRevision: 2,
      minimumRevision: 2,
      advanced: true,
    });
    expect(minimumRevision).toBe(2);
  });

  it("fails closed when the witness transport is unavailable", async () => {
    const { port } = makeStore({
      read: async () => { throw new Error("offline"); },
    });
    await expect(port.readMinimumRevision({ trustDomainId: DOMAIN })).rejects.toThrow("offline");
  });
});

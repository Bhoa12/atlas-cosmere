import { describe, expect, it, vi } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import {
  buildHoidTrustRevisionWitnessReceiptSigningMessage,
  createHoidRemoteTrustRegistryRevisionStorePort,
  type HoidTrustRevisionWitnessCompareAndSetRequest,
  type HoidTrustRevisionWitnessReadRequest,
} from "./remoteTrustRevisionWitness";
import {
  createHoidTrustRevisionWitnessServer,
  type HoidTrustRevisionWitnessServerOptions,
} from "./remoteTrustRevisionWitnessService";

const NOW = "2026-11-19T14:00:00.000Z";
const WITNESS_ID = "atlas-revision-witness";
const KEY_ID = "atlas-witness-key-2026";
const DOMAIN = "atlas-cosmere-production";
const CLIENT_ID = "hoid-reader-app";
const SERVER_SEED = new Uint8Array(32).fill(23);

function hex(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

const SERVER_PUBLIC_KEY = hex(ed25519.getPublicKey(SERVER_SEED));

function readRequest(nonce: number, overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    schemaVersion: 1,
    operation: "read-minimum-revision",
    witnessId: WITNESS_ID,
    trustDomainId: DOMAIN,
    requestNonceHex: nonce.toString(16).padStart(64, "0"),
    ...overrides,
  });
}

function casRequest(nonce: number, expectedRevision = 7, nextRevision = 8, overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    schemaVersion: 1,
    operation: "compare-and-set-minimum-revision",
    witnessId: WITNESS_ID,
    trustDomainId: DOMAIN,
    expectedRevision,
    nextRevision,
    requestNonceHex: nonce.toString(16).padStart(64, "0"),
    ...overrides,
  });
}

function setup(overrides: {
  initialRevision?: number;
  authorize?: (input: unknown) => Promise<unknown>;
  claim?: (input: unknown) => Promise<unknown>;
  read?: () => Promise<unknown>;
  compare?: (input: { expectedRevision: number; nextRevision: number }) => Promise<unknown>;
  sign?: (message: string) => Promise<unknown>;
  now?: () => string;
} = {}) {
  let revision = overrides.initialRevision ?? 7;
  const replayed = new Set<string>();
  const store = {
    readMinimumRevision: vi.fn(async () =>
      overrides.read ? overrides.read() : revision,
    ),
    compareAndSetMinimumRevision: vi.fn(async (input: {
      trustDomainId: string;
      expectedRevision: number;
      nextRevision: number;
    }) => {
      if (overrides.compare) return overrides.compare(input);
      if (revision === input.expectedRevision) {
        revision = input.nextRevision;
        return { outcome: "advanced", observedRevision: revision };
      }
      if (revision === input.nextRevision) {
        return { outcome: "already-applied", observedRevision: revision };
      }
      return { outcome: "conflict", observedRevision: revision };
    }),
  };
  const authorization = {
    authorize: vi.fn(async (input: unknown) =>
      overrides.authorize ? overrides.authorize(input) : true,
    ),
  };
  const replayProtection = {
    claim: vi.fn(async (input: {
      clientId: string;
      trustDomainId: string;
      requestNonceHex: string;
    }) => {
      if (overrides.claim) return overrides.claim(input);
      const key = [input.clientId, input.trustDomainId, input.requestNonceHex].join(":");
      if (replayed.has(key)) return false;
      replayed.add(key);
      return true;
    }),
  };
  const signer = {
    sign: vi.fn(async ({ message }: { keyId: string; message: string }) =>
      overrides.sign
        ? overrides.sign(message)
        : hex(ed25519.sign(new TextEncoder().encode(message), SERVER_SEED)),
    ),
  };
  const clock = { now: vi.fn(() => overrides.now ? overrides.now() : NOW) };

  const options: HoidTrustRevisionWitnessServerOptions = {
    configuration: { witnessId: WITNESS_ID, keyId: KEY_ID, trustDomainId: DOMAIN },
    store,
    authorization,
    replayProtection,
    signer,
    clock,
  };
  const service = createHoidTrustRevisionWitnessServer(options);
  return {
    service,
    store,
    authorization,
    replayProtection,
    signer,
    clock,
    getRevision: () => revision,
  };
}

async function expectValidReceipt(result: Awaited<ReturnType<ReturnType<typeof setup>["service"]["handle"]>>) {
  expect(result.status).toBe("issued");
  if (result.status !== "issued") throw new Error("Expected signed receipt");
  const { signatureHex, ...unsigned } = result.receipt;
  const message = buildHoidTrustRevisionWitnessReceiptSigningMessage(unsigned);
  expect(message).not.toBeNull();
  const verifier = createHoidNobleEd25519VerificationPort();
  await expect(verifier.verify({
    publicKeyHex: SERVER_PUBLIC_KEY,
    message: message!,
    signatureHex,
  })).resolves.toBe(true);
  return result.receipt;
}

describe("Hoid remote trust revision witness server", () => {
  it("issues a real Ed25519-signed read receipt for an authenticated client", async () => {
    const fixture = setup();
    const result = await fixture.service.handle(readRequest(1), CLIENT_ID);
    const receipt = await expectValidReceipt(result);
    expect(receipt).toMatchObject({
      witnessId: WITNESS_ID,
      keyId: KEY_ID,
      trustDomainId: DOMAIN,
      operation: "read-minimum-revision",
      outcome: "read",
      observedRevision: 7,
      requestNonceHex: "0".repeat(63) + "1",
    });
    expect(fixture.store.readMinimumRevision).toHaveBeenCalledTimes(1);
  });

  it("interoperates with the Run 159 client adapter through the signed server handler", async () => {
    const fixture = setup();
    let nonce = 100;
    const clientStore = createHoidRemoteTrustRegistryRevisionStorePort({
      configuration: {
        witnessId: WITNESS_ID,
        keyId: KEY_ID,
        publicKeyHex: SERVER_PUBLIC_KEY,
        trustDomainId: DOMAIN,
      },
      transport: {
        readMinimumRevision: async (request: HoidTrustRevisionWitnessReadRequest) => {
          const result = await fixture.service.handle(request, CLIENT_ID);
          if (result.status !== "issued") throw new Error(result.reason);
          return result.receipt;
        },
        compareAndSetMinimumRevision: async (request: HoidTrustRevisionWitnessCompareAndSetRequest) => {
          const result = await fixture.service.handle(request, CLIENT_ID);
          if (result.status !== "issued") throw new Error(result.reason);
          return result.receipt;
        },
      },
      noncePort: {
        createNonceHex: async () => {
          nonce += 1;
          return nonce.toString(16).padStart(64, "0");
        },
      },
      clock: { now: () => NOW },
      verifier: createHoidNobleEd25519VerificationPort(),
    });

    await expect(clientStore.readMinimumRevision({ trustDomainId: DOMAIN })).resolves.toBe(7);
    await expect(clientStore.compareAndSetMinimumRevision({
      trustDomainId: DOMAIN,
      expectedRevision: 7,
      nextRevision: 8,
    })).resolves.toBe(true);
    await expect(clientStore.readMinimumRevision({ trustDomainId: DOMAIN })).resolves.toBe(8);
  });

  it("issues an authenticated CAS advance receipt and persists the target revision", async () => {
    const fixture = setup();
    const receipt = await expectValidReceipt(
      await fixture.service.handle(casRequest(2, 7, 8), CLIENT_ID),
    );
    expect(receipt).toMatchObject({
      operation: "compare-and-set-minimum-revision",
      expectedRevision: 7,
      nextRevision: 8,
      outcome: "advanced",
      observedRevision: 8,
    });
    expect(fixture.getRevision()).toBe(8);
  });

  it("returns an idempotent already-applied receipt for a repeated target with a fresh nonce", async () => {
    const fixture = setup({ initialRevision: 8 });
    const receipt = await expectValidReceipt(
      await fixture.service.handle(casRequest(3, 7, 8), CLIENT_ID),
    );
    expect(receipt.outcome).toBe("already-applied");
    expect(fixture.getRevision()).toBe(8);
  });

  it("serializes competing CAS operations through the atomic store contract", async () => {
    const fixture = setup();
    const [first, second] = await Promise.all([
      fixture.service.handle(casRequest(4, 7, 8), CLIENT_ID),
      fixture.service.handle(casRequest(5, 7, 9), CLIENT_ID),
    ]);
    const firstReceipt = await expectValidReceipt(first);
    const secondReceipt = await expectValidReceipt(second);
    expect([firstReceipt.outcome, secondReceipt.outcome].sort()).toEqual(["advanced", "conflict"]);
    expect(fixture.getRevision()).toBeGreaterThan(7);
    expect(fixture.getRevision()).toBeLessThanOrEqual(9);
  });

  it("returns an authenticated conflict with the revision observed by the store", async () => {
    const fixture = setup({ initialRevision: 9 });
    const receipt = await expectValidReceipt(
      await fixture.service.handle(casRequest(6, 7, 8), CLIENT_ID),
    );
    expect(receipt).toMatchObject({ outcome: "conflict", expectedRevision: 7, nextRevision: 8, observedRevision: 9 });
  });

  it("rejects an unauthenticated transport identity before calling any authority", async () => {
    const fixture = setup();
    await expect(fixture.service.handle(readRequest(7), null)).resolves.toEqual({
      status: "rejected",
      reason: "unauthenticated",
    });
    expect(fixture.authorization.authorize).not.toHaveBeenCalled();
    expect(fixture.store.readMinimumRevision).not.toHaveBeenCalled();
  });

  it("rejects a client denied by the authorization port before replay or storage access", async () => {
    const fixture = setup({ authorize: async () => false });
    await expect(fixture.service.handle(readRequest(8), CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "forbidden",
    });
    expect(fixture.replayProtection.claim).not.toHaveBeenCalled();
    expect(fixture.store.readMinimumRevision).not.toHaveBeenCalled();
  });

  it("rejects a replayed nonce atomically before a second store operation", async () => {
    const fixture = setup();
    const request = readRequest(9);
    await expect(fixture.service.handle(request, CLIENT_ID)).resolves.toMatchObject({ status: "issued" });
    await expect(fixture.service.handle(request, CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "replay",
    });
    expect(fixture.store.readMinimumRevision).toHaveBeenCalledTimes(1);
  });

  it("does not trust a client identity supplied in request JSON", async () => {
    const fixture = setup();
    await expect(fixture.service.handle(readRequest(10, { clientId: CLIENT_ID }), CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "invalid-request",
    });
    expect(fixture.authorization.authorize).not.toHaveBeenCalled();
  });

  it("rejects accessors and does not execute their getters", async () => {
    const fixture = setup();
    let invoked = false;
    const hostile = {
      schemaVersion: 1,
      witnessId: WITNESS_ID,
      trustDomainId: DOMAIN,
      requestNonceHex: "0".repeat(63) + "1",
    } as Record<string, unknown>;
    Object.defineProperty(hostile, "operation", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "read-minimum-revision";
      },
    });
    await expect(fixture.service.handle(hostile, CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "invalid-request",
    });
    expect(invoked).toBe(false);
  });

  it("rejects a cross-domain request before authenticating or accessing storage", async () => {
    const fixture = setup();
    await expect(fixture.service.handle(
      readRequest(11, { trustDomainId: "another-domain" }),
      CLIENT_ID,
    )).resolves.toEqual({ status: "rejected", reason: "invalid-request" });
    expect(fixture.authorization.authorize).not.toHaveBeenCalled();
    expect(fixture.store.readMinimumRevision).not.toHaveBeenCalled();
  });

  it("fails closed when replay protection is unavailable", async () => {
    const fixture = setup({ claim: async () => { throw new Error("replay store down"); } });
    await expect(fixture.service.handle(readRequest(12), CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "replay-protection-unavailable",
    });
    expect(fixture.store.readMinimumRevision).not.toHaveBeenCalled();
  });

  it("fails closed when the durable store returns an invalid revision", async () => {
    const fixture = setup({ read: async () => 0 });
    await expect(fixture.service.handle(readRequest(13), CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "store-invalid",
    });
    expect(fixture.signer.sign).not.toHaveBeenCalled();
  });

  it("rejects an inconsistent CAS result instead of signing it", async () => {
    const fixture = setup({
      compare: async () => ({ outcome: "advanced", observedRevision: 9 }),
    });
    await expect(fixture.service.handle(casRequest(14, 7, 8), CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "store-invalid",
    });
    expect(fixture.signer.sign).not.toHaveBeenCalled();
  });

  it("fails closed when the signing port returns a malformed signature", async () => {
    const fixture = setup({ sign: async () => "not-a-signature" });
    await expect(fixture.service.handle(readRequest(15), CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "signer-unavailable",
    });
  });

  it("fails closed when the trusted clock is not canonical", async () => {
    const fixture = setup({ now: () => "not-a-date" });
    await expect(fixture.service.handle(readRequest(16), CLIENT_ID)).resolves.toEqual({
      status: "rejected",
      reason: "clock-unavailable",
    });
    expect(fixture.store.readMinimumRevision).not.toHaveBeenCalled();
  });
});

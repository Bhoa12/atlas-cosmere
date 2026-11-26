import { describe, expect, it, vi } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import {
  createHoidExactApprovedClaimAttestation,
  type HoidExactEvidenceRecord,
} from "./exactUnitClaimIntegrity";
import {
  emptyHoidUnitProgressSnapshot,
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  createHoidExactUnitEvidenceRuntime,
  type HoidExactClaimPackage,
  type HoidExactClaimSelectionRequest,
  type HoidExactClaimSelector,
} from "./exactUnitEvidenceRuntime";
import type { HoidExactUnitEvidencePolicy } from "./unitEvidenceAuthorizationV2";

const fixedNow = () => "2026-11-24T18:10:00.000Z";

function reference(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidChapterReference(bookId, {
    chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
  });
  if (result.status !== "ready") throw new Error("Synthetic exact reference unavailable");
  return result.reference;
}

function cursor(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidUnitProgressCursor(bookId, {
    chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
  });
  if (result.status !== "ready") throw new Error("Synthetic exact cursor unavailable");
  return result.cursor;
}

function snapshot(
  positions: readonly Readonly<{ bookId: string; chapterNumber?: number; unitId?: string; completed?: boolean }>[],
  revision = 1,
): HoidUnitProgressSnapshot {
  return Object.freeze({
    schemaVersion: 3,
    revision,
    positions: Object.freeze(positions.map((position, order) => Object.freeze(
      position.completed
        ? { bookId: position.bookId, completed: true as const, order }
        : {
            bookId: position.bookId,
            cursor: cursor(position.bookId, position.chapterNumber!, position.unitId),
            order,
          },
    ))),
    updatedAt: fixedNow(),
  });
}

class MemoryStore implements HoidUnitProgressStore {
  value: unknown = emptyHoidUnitProgressSnapshot();
  async read(): Promise<unknown> { return this.value; }
  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    const current = validateHoidUnitProgressSnapshot(this.value);
    const candidate = validateHoidUnitProgressSnapshot(next);
    if (current.status !== "valid" || candidate.status !== "valid") return false;
    if (current.snapshot.revision !== expectedRevision) return false;
    this.value = candidate.snapshot;
    return true;
  }
}

const evidence: HoidExactEvidenceRecord = Object.freeze({
  id: "evidence.alpha",
  aliases: Object.freeze(["Entidad Alfa"]),
  kind: "character",
  provenance: "verified",
  summary: "Resumen editorial original y sintético para las pruebas.",
});

function packageFor(policyInput?: HoidExactUnitEvidencePolicy): HoidExactClaimPackage {
  const policy: HoidExactUnitEvidencePolicy = policyInput ?? Object.freeze({
    schemaVersion: 2,
    evidenceId: evidence.id,
    source: reference("twok", 2),
    firstSafeAppearance: reference("twok", 2),
    unlock: reference("twok", 3),
  });
  const core = Object.freeze({
    id: "claim.alpha",
    text: "Afirmación editorial sintética respaldada por evidencia exacta.",
    intent: "explain" as const,
    evidenceIds: Object.freeze([evidence.id]),
    entityIds: Object.freeze([evidence.id]),
  });
  const reviewer = Object.freeze({
    reviewerId: "editorial-reviewer",
    reviewedAt: "2026-11-24T18:10:00.000Z",
  });
  const attestation = createHoidExactApprovedClaimAttestation(core, [evidence], [policy], reviewer);
  if (attestation.status !== "valid") throw new Error("Synthetic exact claim attestation failed");
  return Object.freeze({
    claim: Object.freeze({ ...core, integrity: attestation.integrity, review: attestation.review }),
    evidence: Object.freeze([evidence]),
    policies: Object.freeze([policy]),
  });
}

function selectorFor(
  select?: (request: HoidExactClaimSelectionRequest) => Promise<unknown>,
): HoidExactClaimSelector {
  return {
    selectClaims: async (request) => select
      ? select(request)
      : Object.freeze({
          schemaVersion: 2,
          requestFingerprint: request.requestFingerprint,
          claimIds: Object.freeze(["claim.alpha"]),
        }),
  };
}

function createRuntime(store: MemoryStore, selector = selectorFor()) {
  const coordinator = new HoidUnitProgressCoordinator(store, fixedNow);
  const runtime = createHoidExactUnitEvidenceRuntime({
    coordinator,
    packages: [packageFor()],
    selector,
  });
  if (!runtime) throw new Error("Synthetic exact runtime could not be created");
  return { runtime, coordinator };
}

describe("Hoid exact-unit evidence runtime v2", () => {
  it("selects only authorized claims and keeps progress/references out of provider egress", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    let providerRequest: HoidExactClaimSelectionRequest | undefined;
    const { runtime } = createRuntime(store, selectorFor(async request => {
      providerRequest = request;
      return {
        schemaVersion: 2,
        requestFingerprint: request.requestFingerprint,
        claimIds: ["claim.alpha"],
      };
    }));

    const result = await runtime.answer({
      question: "Explícame este concepto.",
      intent: "explain",
      depth: "detailed",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(providerRequest).toBeDefined();
    expect(Object.keys(providerRequest!)).toEqual([
      "schemaVersion", "requestFingerprint", "question", "intent", "candidates", "selectionBudget",
    ]);
    expect(JSON.stringify(providerRequest)).not.toContain("unitId");
    expect(JSON.stringify(providerRequest)).not.toContain("identityFingerprint");
    expect(JSON.stringify(providerRequest)).not.toContain("progressRevision");
    expect(result.answer.sources[0].source.bookId).toBe("twok");
    expect(result.answer.sources[0].unlock.ordinal).toBe(3);
  });

  it("blocks a locked entity alias before invoking the selector", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 2 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: 2,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));
    const result = await runtime.answer({
      question: "¿Quién es Entidad Alfa?",
      intent: "explain",
    });
    expect(result).toEqual({ status: "unavailable", reason: "evidence-locked" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("invalidates an answer when durable progress regresses during provider selection", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const selector = selectorFor(async request => {
      store.value = snapshot([{ bookId: "twok", chapterNumber: 2 }], 2);
      return {
        schemaVersion: 2,
        requestFingerprint: request.requestFingerprint,
        claimIds: ["claim.alpha"],
      };
    });
    const { runtime } = createRuntime(store, selector);
    expect(await runtime.answer({
      question: "Explícame el concepto.",
      intent: "explain",
    })).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("revalidates a presentation receipt immediately before rendering", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const { runtime } = createRuntime(store);
    const result = await runtime.answer({
      question: "Explícame el concepto.",
      intent: "explain",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    store.value = snapshot([{ bookId: "twok", chapterNumber: 2 }], 2);
    expect(await runtime.verifyForPresentation({
      progressRevision: result.progressRevision,
      progressFingerprint: result.progressFingerprint,
      evidenceIds: result.answer.evidenceIds,
    })).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("rejects a selector response containing an unknown claim ID", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const { runtime } = createRuntime(store, selectorFor(async request => ({
      schemaVersion: 2,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.not-approved"],
    })));
    expect(await runtime.answer({
      question: "Explícame el concepto.",
      intent: "explain",
    })).toEqual({ status: "unavailable", reason: "invalid-selection" });
  });

  it("supports cross-work policies only after all three exact prerequisites are complete", async () => {
    const crossPolicy: HoidExactUnitEvidencePolicy = Object.freeze({
      schemaVersion: 2,
      evidenceId: evidence.id,
      source: reference("twok", 2),
      firstSafeAppearance: reference("edgedancer", 3),
      unlock: reference("warbreaker", 2),
    });
    const store = new MemoryStore();
    store.value = snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 3 },
    ]);
    const coordinator = new HoidUnitProgressCoordinator(store, fixedNow);
    const runtime = createHoidExactUnitEvidenceRuntime({
      coordinator,
      packages: [packageFor(crossPolicy)],
      selector: selectorFor(),
    });
    expect(runtime).not.toBeNull();
    const result = await runtime!.answer({
      question: "Explícame Entidad Alfa.",
      intent: "explain",
      depth: "detailed",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(new Set(result.answer.sources[0].source.bookId === "twok"
      ? [result.answer.sources[0].source.bookId, result.answer.sources[0].firstSafeAppearance.bookId, result.answer.sources[0].unlock.bookId]
      : [])).toEqual(new Set(["twok", "edgedancer", "warbreaker"]));
  });

  it("withholds a cross-work claim before provider egress when one exact prerequisite remains open", async () => {
    const crossPolicy: HoidExactUnitEvidencePolicy = Object.freeze({
      schemaVersion: 2,
      evidenceId: evidence.id,
      source: reference("twok", 2),
      firstSafeAppearance: reference("edgedancer", 3),
      unlock: reference("warbreaker", 2),
    });
    const store = new MemoryStore();
    store.value = snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
    ]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const coordinator = new HoidUnitProgressCoordinator(store, fixedNow);
    const runtime = createHoidExactUnitEvidenceRuntime({
      coordinator,
      packages: [packageFor(crossPolicy)],
      selector: { selectClaims: selector },
    });
    expect(runtime).not.toBeNull();
    const result = await runtime!.answer({
      question: "Explica una relación entre varias obras.",
      intent: "explain",
      depth: "detailed",
    });
    expect(result).toEqual({ status: "unavailable", reason: "spoiler-dependency-locked" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects malformed requests and accessor-backed fields without invoking getters", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const { runtime } = createRuntime(store);
    let invoked = false;
    const hostile = Object.defineProperty({}, "question", {
      enumerable: true,
      get() { invoked = true; return "question"; },
    });
    expect(await runtime.answer(hostile)).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
    expect(invoked).toBe(false);
  });

  it("fails closed when the durable progress store is unavailable", async () => {
    const coordinator = new HoidUnitProgressCoordinator({
      read: async () => { throw new Error("offline"); },
      compareAndSwap: async () => false,
    }, fixedNow);
    const runtime = createHoidExactUnitEvidenceRuntime({
      coordinator,
      packages: [packageFor()],
      selector: selectorFor(),
    });
    expect(runtime).not.toBeNull();
    expect(await runtime!.answer({
      question: "Explícame el concepto.",
      intent: "explain",
    })).toEqual({ status: "unavailable", reason: "progress-unavailable" });
  });

  it("rejects packages whose exact claim attestation is altered", () => {
    const item = packageFor();
    const tampered = {
      ...item,
      claim: { ...item.claim, text: "Texto no revisado." },
    };
    const store = new MemoryStore();
    const coordinator = new HoidUnitProgressCoordinator(store, fixedNow);
    expect(createHoidExactUnitEvidenceRuntime({
      coordinator,
      packages: [tampered],
      selector: selectorFor(),
    })).toBeNull();
  });

  it("passes bounded conversation identifiers using selection protocol v3 without progress or chapter metadata", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    let providerRequest: HoidExactClaimSelectionRequest | undefined;
    const { runtime } = createRuntime(store, selectorFor(async request => {
      providerRequest = request;
      return {
        schemaVersion: request.schemaVersion,
        requestFingerprint: request.requestFingerprint,
        claimIds: ["claim.alpha"],
      };
    }));
    const result = await runtime.answer({
      question: "¿Y qué relación tiene con ella?",
      intent: "explain",
      depth: "detailed",
      entityIds: ["evidence.alpha"],
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      conversationContext: {
        schemaVersion: 1,
        priorClaimIds: ["claim.alpha"],
        entityIds: ["evidence.alpha"],
        bookIds: ["twok"],
      },
    });
    expect(result.status).toBe("ready");
    expect(providerRequest?.schemaVersion).toBe(3);
    expect(providerRequest?.conversationContext).toEqual({
      schemaVersion: 1,
      priorClaimIds: ["claim.alpha"],
      entityIds: ["evidence.alpha"],
      bookIds: ["twok"],
    });
    expect(JSON.stringify(providerRequest)).not.toContain("progressRevision");
    expect(JSON.stringify(providerRequest)).not.toContain("progressFingerprint");
    expect(JSON.stringify(providerRequest)).not.toContain("unitId");
    expect(JSON.stringify(providerRequest)).not.toContain("identityFingerprint");
    if (result.status === "ready") expect(result.answer.entityIds).toEqual(["evidence.alpha"]);
  });

  it("rejects conversation context that widens entity scope before provider invocation", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));
    expect(await runtime.answer({
      question: "Seguimos.",
      intent: "explain",
      entityIds: ["evidence.alpha"],
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      conversationContext: {
        schemaVersion: 1,
        priorClaimIds: ["claim.alpha"],
        entityIds: ["evidence.other"],
        bookIds: ["twok"],
      },
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects unknown works in provider-visible conversation context", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));
    expect(await runtime.answer({
      question: "Seguimos.",
      intent: "explain",
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      conversationContext: {
        schemaVersion: 1,
        priorClaimIds: ["claim.alpha"],
        entityIds: [],
        bookIds: ["unknown-work"],
      },
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(selector).not.toHaveBeenCalled();
  });


  it("binds exact-unit spoiler dependencies into the v2 selector fingerprint without exposing their references", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    let providerRequest: HoidExactClaimSelectionRequest | undefined;
    const { runtime } = createRuntime(store, selectorFor(async request => {
      providerRequest = request;
      return { schemaVersion: 2, requestFingerprint: request.requestFingerprint, claimIds: ["claim.alpha"] };
    }));
    const result = await runtime.answer({
      question: "Explica Entidad Alfa.",
      intent: "explain",
      depth: "brief",
    });
    expect(result.status).toBe("ready");
    const request = providerRequest!;
    expect(request.schemaVersion).toBe(2);
    expect(request.conversationContext).toBeUndefined();
    // The opaque digest now commits to the exact-unit spoiler dependency set.
    // Chapter identities and progress thresholds must remain local to Hoid.
    expect(request.requestFingerprint).toBe("9f4c42f162936422926b993b05061edb00ea2f13615bf446f9ae4cd7722ee6e9");
    expect(JSON.stringify(request)).not.toMatch(/chapterNumber|unitId|completedThroughChapter|navigationSha256/u);
  });


  it("restricts exact-unit follow-ups to prior cited chapter identities without sending them to the selector", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    let providerRequest: HoidExactClaimSelectionRequest | undefined;
    const { runtime } = createRuntime(store, selectorFor(async request => {
      providerRequest = request;
      return {
        schemaVersion: request.schemaVersion,
        requestFingerprint: request.requestFingerprint,
        claimIds: ["claim.alpha"],
      };
    }));

    const result = await runtime.answer({
      question: "Explícame el concepto con más detalle.",
      intent: "explain",
      depth: "detailed",
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      chapterScope: [reference("twok", 2)],
    });

    expect(result.status).toBe("ready");
    expect(providerRequest).toBeDefined();
    expect(providerRequest!.candidates.map(candidate => candidate.id)).toEqual(["claim.alpha"]);
    expect(Object.keys(providerRequest!)).not.toContain("chapterScope");
    expect(JSON.stringify(providerRequest)).not.toContain("unitId");
    expect(JSON.stringify(providerRequest)).not.toContain("identityFingerprint");
    expect(JSON.stringify(providerRequest)).not.toContain("locatorId");
  });

  it("does not widen a chapter-scoped follow-up when no claim source matches the cited chapter", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));

    expect(await runtime.answer({
      question: "Continúa la explicación.",
      intent: "explain",
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      chapterScope: [reference("twok", 3)],
    })).toEqual({ status: "unavailable", reason: "no-authorized-claims" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects stale chapter fingerprints before invoking the selector", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));
    const stale = Object.freeze({
      ...reference("twok", 2),
      identityFingerprint: "0".repeat(64),
    });

    expect(await runtime.answer({
      question: "Continúa.",
      intent: "explain",
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      chapterScope: [stale],
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects chapter references outside the declared book scope", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));

    expect(await runtime.answer({
      question: "Continúa.",
      intent: "explain",
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      chapterScope: [reference("edgedancer", 2)],
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("requires at least one exact chapter anchor for every work in a cross-work scope", async () => {
    const store = new MemoryStore();
    store.value = snapshot([
      { bookId: "twok", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 4 },
    ]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));

    expect(await runtime.answer({
      question: "Compara el contexto.",
      intent: "explain",
      bookScope: { mode: "cross-work", bookIds: ["twok", "warbreaker"] },
      chapterScope: [reference("twok", 2)],
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("does not let a cited-chapter scope bypass the independent unlock threshold", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 2 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));

    expect(await runtime.answer({
      question: "Explícame el concepto.",
      intent: "explain",
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      chapterScope: [reference("twok", 2)],
    })).toEqual({ status: "unavailable", reason: "spoiler-dependency-locked" });
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects sparse chapter-scope arrays", async () => {
    const store = new MemoryStore();
    store.value = snapshot([{ bookId: "twok", chapterNumber: 4 }]);
    const selector = vi.fn(async (request: HoidExactClaimSelectionRequest) => ({
      schemaVersion: request.schemaVersion,
      requestFingerprint: request.requestFingerprint,
      claimIds: ["claim.alpha"],
    }));
    const { runtime } = createRuntime(store, selectorFor(selector));
    const sparse = new Array(1);

    expect(await runtime.answer({
      question: "Continúa.",
      intent: "explain",
      bookScope: { mode: "single-work", bookIds: ["twok"] },
      chapterScope: sparse,
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(selector).not.toHaveBeenCalled();
  });
});

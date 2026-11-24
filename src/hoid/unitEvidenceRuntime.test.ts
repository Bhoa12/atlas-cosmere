import { describe, expect, it, vi } from "vitest";
import {
  createHoidUnitEvidenceRuntime,
  type HoidUnitEvidencePolicy,
} from "./unitEvidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
  type HoidApprovedClaimCore,
} from "./approvedClaimIntegrity";
import {
  createHoidChapterReference,
} from "./chapterReference";
import { getHoidReadingManifest } from "./readingManifest";
import {
  createHoidUnitProgressCursor,
} from "./unitProgressCursor";
import {
  emptyHoidUnitProgressSnapshot,
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  createHoidClaimSelectionResponse,
  type HoidClaimSelectionRequest,
} from "./selectionProtocol";
import type {
  HoidClaimSelectionContext,
} from "./evidenceRuntime";

function locator(bookId: string, chapter: number): string {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Synthetic manifest unavailable");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Synthetic locator unavailable");
  return unit.locatorId;
}

function reference(bookId: string, chapter: number, locatorId?: string, unitId?: string) {
  const result = createHoidChapterReference(bookId, {
    chapterNumber: chapter,
    ...(locatorId ? { locatorId } : {}),
    ...(unitId ? { unitId } : {}),
  });
  if (result.status !== "ready") throw new Error("Exact synthetic reference unavailable");
  return result.reference;
}

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-alpha",
    aliases: ["Personaje Alfa"],
    kind: "character",
    firstSafeAppearance: { bookId: "twok", chapter: 2 },
    evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
    evidenceUnlock: { bookId: "twok", chapter: 3 },
    provenance: "verified",
    summary: "Resumen editorial original sintético de Personaje Alfa.",
  },
  {
    id: "e-beta",
    aliases: ["Personaje Beta"],
    kind: "character",
    firstSafeAppearance: { bookId: "edgedancer", chapter: 3 },
    evidenceSource: { bookId: "edgedancer", chapter: 3, locatorId: locator("edgedancer", 3) },
    evidenceUnlock: { bookId: "edgedancer", chapter: 3 },
    provenance: "verified",
    summary: "Resumen editorial original sintético de Personaje Beta.",
  },
];

const policies: HoidUnitEvidencePolicy[] = [
  Object.freeze({
    evidenceId: "e-alpha",
    source: reference("twok", 2, locator("twok", 2)),
    firstSafeAppearance: reference("twok", 2),
    unlock: reference("twok", 3),
  }),
  Object.freeze({
    evidenceId: "e-beta",
    source: reference("edgedancer", 3, locator("edgedancer", 3)),
    firstSafeAppearance: reference("edgedancer", 3),
    unlock: reference("edgedancer", 3),
  }),
];

const reviewer = Object.freeze({
  reviewerId: "unit-runtime-test-editor",
  reviewedAt: "2026-11-24T15:00:00.000Z",
});

function approvedClaim(core: HoidApprovedClaimCore): HoidApprovedClaim {
  const result = createHoidApprovedClaimAttestation(core, knowledge, reviewer);
  if (result.status !== "valid") throw new Error("Synthetic claim attestation failed: " + result.reason);
  return Object.freeze({ ...core, integrity: result.integrity, review: result.review });
}

const claims: HoidApprovedClaim[] = [
  approvedClaim({
    id: "claim-alpha",
    text: "Afirmación editorial aprobada y sintética sobre Personaje Alfa.",
    intent: "explain",
    evidenceIds: ["e-alpha"],
    entityIds: ["e-alpha"],
  }),
  approvedClaim({
    id: "claim-cross",
    text: "Relación editorial sintética entre Personaje Alfa y Personaje Beta.",
    intent: "explain",
    evidenceIds: ["e-alpha", "e-beta"],
    entityIds: ["e-alpha", "e-beta"],
  }),
];

function cursor(bookId: string, chapter: number) {
  const created = createHoidUnitProgressCursor(bookId, { chapterNumber: chapter });
  if (created.status !== "ready") throw new Error("Synthetic progress cursor unavailable");
  return created.cursor;
}

function snapshot(
  entries: readonly Readonly<{ bookId: string; chapter: number }>[],
  revision = 1,
): HoidUnitProgressSnapshot {
  return Object.freeze({
    schemaVersion: 3,
    revision,
    positions: Object.freeze(entries.map((entry, order) => Object.freeze({
      bookId: entry.bookId,
      cursor: cursor(entry.bookId, entry.chapter),
      order,
    }))),
    updatedAt: "2026-11-24T15:00:00.000Z",
  });
}

class MemoryStore implements HoidUnitProgressStore {
  value: unknown;

  constructor(value: unknown = emptyHoidUnitProgressSnapshot()) {
    this.value = value;
  }

  async read(): Promise<unknown> {
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    const current = validateHoidUnitProgressSnapshot(this.value);
    const candidate = validateHoidUnitProgressSnapshot(next);
    if (current.status !== "valid" || candidate.status !== "valid") return false;
    if (current.snapshot.revision !== expectedRevision) return false;
    this.value = candidate.snapshot;
    return true;
  }
}

function selectorAdapter(
  operation: (
    request: HoidClaimSelectionRequest,
    context: HoidClaimSelectionContext,
  ) => Promise<unknown>,
) {
  return {
    selectClaims: async (request: HoidClaimSelectionRequest, context: HoidClaimSelectionContext) => {
      const result = await operation(request, context);
      return Array.isArray(result) && result.every(value => typeof value === "string")
        ? createHoidClaimSelectionResponse(request, result as string[])
        : result;
    },
  };
}

function createRuntime(
  store: MemoryStore,
  select?: (
    request: HoidClaimSelectionRequest,
    context: HoidClaimSelectionContext,
  ) => Promise<unknown>,
) {
  const coordinator = new HoidUnitProgressCoordinator(store, () => "2026-11-24T15:00:00.000Z");
  return {
    coordinator,
    runtime: createHoidUnitEvidenceRuntime({
      coordinator,
      knowledge,
      claims,
      policies,
      selector: select ? selectorAdapter(select) : null,
    }),
  };
}

describe("Hoid exact-unit evidence runtime", () => {
  it("authorizes only exact-unit evidence and returns exact citations", async () => {
    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 4 }]));
    const selector = vi.fn(async (request: HoidClaimSelectionRequest) => {
      expect(request.candidates.map(candidate => candidate.id)).toEqual(["claim-alpha"]);
      expect("reading" in request).toBe(false);
      expect("progress" in request).toBe(false);
      expect("chapterReferences" in request).toBe(false);
      expect("progressFingerprint" in request).toBe(false);
      expect("locatorId" in request).toBe(false);
      expect("unitId" in request.candidates[0]).toBe(false);
      expect("identityFingerprint" in request.candidates[0]).toBe(false);
      return ["claim-alpha"];
    });
    const { runtime } = createRuntime(store, selector);
    expect(runtime).not.toBeNull();

    const result = await runtime!.answer({ question: "¿Quién es Personaje Alfa?" });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.answer.status).toBe("authorized");
    expect(result.answer.claimIds).toEqual(["claim-alpha"]);
    expect(result.answer.sources).toEqual([{
      evidenceId: "e-alpha",
      source: policies[0].source,
      firstSafeAppearance: policies[0].firstSafeAppearance,
      unlock: policies[0].unlock,
    }]);
    expect(result.progressRevision).toBe(1);
    expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(selector).toHaveBeenCalledTimes(1);
    const presentation = await runtime!.verifyForPresentation({
      progressRevision: result.progressRevision,
      progressFingerprint: result.progressFingerprint,
      evidenceIds: result.answer.evidenceIds,
    });
    expect(presentation).toMatchObject({ status: "ready", progressRevision: 1 });
  });

  it("blocks a matching entity while its exact unlock unit is still open", async () => {
    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 3 }]));
    const selector = vi.fn(async () => ["claim-alpha"]);
    const { runtime } = createRuntime(store, selector);
    const result = await runtime!.answer({ question: "¿Quién es Personaje Alfa?" });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.answer.status).toBe("blocked");
    expect(result.answer.reason).toBe("reading-position");
    expect(selector).not.toHaveBeenCalled();
    const presentation = await runtime!.verifyForPresentation({
      progressRevision: result.progressRevision,
      progressFingerprint: result.progressFingerprint,
      evidenceIds: [],
    });
    expect(presentation).toMatchObject({ status: "ready", progressRevision: 1 });
  });

  it("rejects an exact chapter scope that points at the currently open unit", async () => {
    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 4 }]));
    const selector = vi.fn(async () => ["claim-alpha"]);
    const { runtime } = createRuntime(store, selector);
    const openChapter = reference("twok", 4);
    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      chapterReferences: [openChapter],
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.answer.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();
  });

  it("filters claims to the requested exact chapter references", async () => {
    const store = new MemoryStore(snapshot([
      { bookId: "twok", chapter: 8 },
      { bookId: "edgedancer", chapter: 4 },
    ]));
    const selector = vi.fn(async (request: HoidClaimSelectionRequest) => {
      expect(request.candidates.map(candidate => candidate.id)).toEqual(["claim-alpha"]);
      return ["claim-alpha"];
    });
    const { runtime } = createRuntime(store, selector);
    const chapterTwo = reference("twok", 2);
    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      chapterReferences: [chapterTwo],
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(selector).toHaveBeenCalledTimes(1);
    expect(result.answer.status).toBe("authorized");
    expect(result.answer.claimIds).toEqual(["claim-alpha"]);
  });

  it("invalidates an answer when another coordinator changes progress during provider work", async () =>    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 4 }]));
    const selector = vi.fn(async () => {
      store.value = snapshot([{ bookId: "twok", chapter: 2 }], 2);
      return ["claim-alpha"];
    });
    const { runtime } = createRuntime(store, selector);
    const result = await runtime!.answer({ question: "¿Quién es Personaje Alfa?" });

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("requires a fresh receipt immediately before presentation", async () => {
    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 4 }]));
    const { runtime } = createRuntime(store, async () => ["claim-alpha"]);
    const result = await runtime!.answer({ question: "¿Quién es Personaje Alfa?" });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    store.value = snapshot([{ bookId: "twok", chapter: 2 }], 2);
    const verification = await runtime!.verifyForPresentation({
      progressRevision: result.progressRevision,
      progressFingerprint: result.progressFingerprint,
      evidenceIds: result.answer.evidenceIds,
    });
    expect(verification).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("returns metadata-only resume and unstarted-source recommendations", async () => {
    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 4 }]));
    const { runtime } = createRuntime(store);
    const result = await runtime!.recommend(2);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items[0]).toMatchObject({
      sourceId: "twok",
      reason: "resume-current-unit",
      currentChapterNumber: 4,
      currentOrdinal: 4,
      completedThroughOrdinal: 3,
    });
    expect(result.items[1]).toMatchObject({
      reason: "unstarted-source",
    });
    expect(result.items[1]).not.toHaveProperty("canonOrder");
  });

  it("rejects a policy whose exact source identity does not match its reviewed locator", () => {
    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 4 }]));
    const mismatched = policies.map(policy => policy.evidenceId === "e-alpha"
      ? { ...policy, source: reference("twok", 3, locator("twok", 3)) }
      : policy);
    const coordinator = new HoidUnitProgressCoordinator(store);
    expect(createHoidUnitEvidenceRuntime({
      coordinator,
      knowledge,
      claims,
      policies: mismatched,
      selector: null,
    })).toBeNull();
  });

  it("rejects accessor-backed request properties without invoking getters", async () => {
    const store = new MemoryStore(snapshot([{ bookId: "twok", chapter: 4 }]));
    const { runtime } = createRuntime(store);
    let invoked = false;
    const hostile = Object.defineProperty({}, "question", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("must not execute");
      },
    });
    const result = await runtime!.answer(hostile);
    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(invoked).toBe(false);
  });

  it("rejects unsupported duplicate-label thresholds while the legacy review binding is numeric", () => {
    const store = new MemoryStore(snapshot([{ bookId: "sawt", chapter: 11 }]));
    const duplicate = reference("sawt", 12, undefined, "chapter:012:unit:012");
    const source = reference("sawt", 11, locator("sawt", 11));
    const unsupportedKnowledge: HoidKnowledgeEntry[] = [{
      id: "e-duplicate",
      aliases: ["Entidad duplicada sintética"],
      kind: "concept",
      firstSafeAppearance: { bookId: "sawt", chapter: 10 },
      evidenceSource: { bookId: "sawt", chapter: 11, locatorId: locator("sawt", 11) },
      evidenceUnlock: { bookId: "sawt", chapter: 11 },
      provenance: "verified",
      summary: "Resumen sintético no narrativo.",
    }];
    const unsupportedPolicy = [{
      evidenceId: "e-duplicate",
      source,
      firstSafeAppearance: reference("sawt", 10),
      unlock: duplicate,
    }];
    const coordinator = new HoidUnitProgressCoordinator(store);
    expect(createHoidUnitEvidenceRuntime({
      coordinator,
      knowledge: unsupportedKnowledge,
      claims: [],
      policies: unsupportedPolicy,
      selector: null,
    })).toBeNull();
  });
});

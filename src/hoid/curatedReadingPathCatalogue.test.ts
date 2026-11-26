import { describe, expect, it, vi } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import type { HoidUnitProgressSnapshot } from "./unitProgressLedger";
import {
  buildHoidCuratedReadingPathCatalogue,
  buildHoidReadingPathApprovalSigningMessage,
  evaluateHoidCuratedReadingPathRecommendations,
  HOID_CURATED_READING_PATH_CATALOGUE,
  validateHoidCuratedReadingPathCatalogue,
  validateHoidCuratedReadingPathRecommendationPlan,
  verifyHoidCuratedReadingPathCatalogueApproval,
} from "./curatedReadingPathCatalogue";

const NOW = "2026-11-26T05:00:00.000Z";
const REPOSITORY = "Bhoa12/atlas-cosmere";

function reference(bookId: string, chapterNumber: number) {
  const result = createHoidChapterReference(bookId, { chapterNumber });
  if (result.status !== "ready") throw new Error("Test reference unavailable");
  return result.reference;
}

function makeCatalogue() {
  const through = reference("twok", 2);
  const evidence = reference("twok", 1);
  const result = buildHoidCuratedReadingPathCatalogue({
    catalogueId: "synthetic-reading-paths",
    revision: 1,
    paths: [{
      pathId: "synthetic-roshar-path",
      title: "Ruta sintética de pruebas",
      description: "Fixture técnico; no representa una recomendación editorial real.",
      steps: [
        {
          stepId: "start-twok",
          workId: "twok",
          rationale: "Primer paso de una ruta sintética.",
          prerequisites: [],
          rationaleEvidence: [],
        },
        {
          stepId: "continue-wor",
          workId: "wor",
          rationale: "Paso posterior de una ruta sintética, sujeto a progreso.",
          prerequisites: [{ stepId: "start-twok", through }],
          rationaleEvidence: [{ evidenceId: "test-evidence-one", reference: evidence }],
        },
      ],
    }],
  });
  if (result.status !== "ready") throw new Error("Test catalogue invalid");
  return result.catalogue;
}

function makeProgress(
  position:
    | Readonly<{ kind: "empty" }>
    | Readonly<{ kind: "completed"; bookId: string }>
    | Readonly<{ kind: "cursor"; bookId: string; chapterNumber: number }>
    | Readonly<{ kind: "two-completed" }>,
  revision = 1,
): HoidUnitProgressSnapshot {
  if (position.kind === "empty") {
    return Object.freeze({
      schemaVersion: 3,
      revision: 0,
      positions: Object.freeze([]),
      updatedAt: null,
    });
  }
  if (position.kind === "completed") {
    return Object.freeze({
      schemaVersion: 3,
      revision,
      positions: Object.freeze([
        Object.freeze({ bookId: position.bookId, completed: true as const, order: 0 }),
      ]),
      updatedAt: NOW,
    });
  }
  if (position.kind === "two-completed") {
    return Object.freeze({
      schemaVersion: 3,
      revision,
      positions: Object.freeze([
        Object.freeze({ bookId: "twok", completed: true as const, order: 0 }),
        Object.freeze({ bookId: "wor", completed: true as const, order: 1 }),
      ]),
      updatedAt: NOW,
    });
  }
  const cursor = createHoidUnitProgressCursor(position.bookId, {
    chapterNumber: position.chapterNumber,
  });
  if (cursor.status !== "ready") throw new Error("Test progress cursor unavailable");
  return Object.freeze({
    schemaVersion: 3,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: position.bookId, cursor: cursor.cursor, order: 0 }),
    ]),
    updatedAt: NOW,
  });
}

const ROOT_KEY = Object.freeze({
  keyId: "hoid-test-root",
  publicKeyHex: "a".repeat(64),
});

const TRUST_REGISTRY = Object.freeze({
  schemaVersion: 1,
  revision: 4,
  issuedAt: "2026-11-25T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
  keys: Object.freeze([
    Object.freeze({
      keyId: "reviewer-key-one",
      reviewerId: "reviewer-one",
      algorithm: "Ed25519" as const,
      publicKeyHex: "b".repeat(64),
      status: "active" as const,
      validFrom: "2026-11-01T00:00:00.000Z",
      validUntil: "2026-12-31T00:00:00.000Z",
      revokedAt: null,
      allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
    }),
    Object.freeze({
      keyId: "reviewer-key-two",
      reviewerId: "reviewer-two",
      algorithm: "Ed25519" as const,
      publicKeyHex: "c".repeat(64),
      status: "active" as const,
      validFrom: "2026-11-01T00:00:00.000Z",
      validUntil: "2026-12-31T00:00:00.000Z",
      revokedAt: null,
      allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
    }),
  ]),
  rootSignature: Object.freeze({
    algorithm: "Ed25519" as const,
    keyId: ROOT_KEY.keyId,
    signatureHex: "d".repeat(128),
  }),
});

const VERIFIER = Object.freeze({
  verify: async () => true,
});

function attestations(
  catalogue = makeCatalogue(),
  decision: "approve" | "reject" = "approve",
) {
  return Object.freeze([
    Object.freeze({
      schemaVersion: 1 as const,
      catalogueFingerprint: catalogue.fingerprint,
      reviewerId: "reviewer-one",
      decision,
      reviewedAt: NOW,
      keyId: "reviewer-key-one",
      signatureHex: "e".repeat(128),
    }),
    Object.freeze({
      schemaVersion: 1 as const,
      catalogueFingerprint: catalogue.fingerprint,
      reviewerId: "reviewer-two",
      decision,
      reviewedAt: NOW,
      keyId: "reviewer-key-two",
      signatureHex: "f".repeat(128),
    }),
  ]);
}

function approvalInput(catalogue = makeCatalogue(), decisions: "approve" | "reject" = "approve") {
  return {
    catalogue,
    attestations: attestations(catalogue, decisions),
    repositoryFullName: REPOSITORY,
    registry: TRUST_REGISTRY,
    rootKey: ROOT_KEY,
    verifier: VERIFIER,
    now: NOW,
    minimumRegistryRevision: 4,
  };
}

function evaluationInput(
  progressSnapshot: HoidUnitProgressSnapshot,
  catalogue = makeCatalogue(),
  decisions: "approve" | "reject" = "approve",
) {
  return {
    ...approvalInput(catalogue, decisions),
    progressSnapshot,
  };
}

describe("Hoid curated reading path catalogue", () => {
  it("builds a deterministic catalogue with explicit earlier-step prerequisites", () => {
    const catalogue = makeCatalogue();
    expect(validateHoidCuratedReadingPathCatalogue(catalogue).status).toBe("valid");
    expect(catalogue.paths).toHaveLength(1);
    expect(catalogue.paths[0].steps[1].prerequisites[0].stepId).toBe("start-twok");
    expect(catalogue.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("allows an explicitly empty catalogue but exposes no route", () => {
    expect(HOID_CURATED_READING_PATH_CATALOGUE).toMatchObject({ paths: [] });
  });

  it("rejects a target work outside the user-provided bibliography", () => {
    const result = buildHoidCuratedReadingPathCatalogue({
      catalogueId: "invalid-paths",
      revision: 1,
      paths: [{
        pathId: "unknown-work-path",
        title: "Invalid",
        description: "Unknown work must fail closed.",
        steps: [{
          stepId: "unknown",
          workId: "not-in-catalogue",
          rationale: "Invalid",
          prerequisites: [],
          rationaleEvidence: [],
        }],
      }],
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-path" });
  });

  it("rejects a prerequisite that points forward instead of to an earlier step", () => {
    const through = reference("twok", 2);
    const result = buildHoidCuratedReadingPathCatalogue({
      catalogueId: "forward-reference",
      revision: 1,
      paths: [{
        pathId: "forward-reference",
        title: "Invalid",
        description: "A later step cannot be a prerequisite.",
        steps: [
          {
            stepId: "first",
            workId: "twok",
            rationale: "First",
            prerequisites: [{ stepId: "second", through }],
            rationaleEvidence: [],
          },
          {
            stepId: "second",
            workId: "wor",
            rationale: "Second",
            prerequisites: [{ stepId: "first", through }],
            rationaleEvidence: [{ evidenceId: "evidence", reference: reference("twok", 1) }],
          },
        ],
      }],
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-path" });
  });

  it("rejects rationale evidence beyond the prerequisite completion boundary", () => {
    const result = buildHoidCuratedReadingPathCatalogue({
      catalogueId: "evidence-beyond-boundary",
      revision: 1,
      paths: [{
        pathId: "evidence-beyond-boundary",
        title: "Invalid",
        description: "Evidence cannot exceed the completed prerequisite.",
        steps: [
          {
            stepId: "first",
            workId: "twok",
            rationale: "First",
            prerequisites: [],
            rationaleEvidence: [],
          },
          {
            stepId: "second",
            workId: "wor",
            rationale: "Second",
            prerequisites: [{ stepId: "first", through: reference("twok", 2) }],
            rationaleEvidence: [{ evidenceId: "too-late", reference: reference("twok", 3) }],
          },
        ],
      }],
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-path" });
  });

  it("requires every later step to declare both prerequisites and bounded rationale evidence", () => {
    const result = buildHoidCuratedReadingPathCatalogue({
      catalogueId: "implicit-order",
      revision: 1,
      paths: [{
        pathId: "implicit-order",
        title: "Invalid",
        description: "The array order alone is not a prerequisite.",
        steps: [
          {
            stepId: "first",
            workId: "twok",
            rationale: "First",
            prerequisites: [],
            rationaleEvidence: [],
          },
          {
            stepId: "second",
            workId: "wor",
            rationale: "Second",
            prerequisites: [],
            rationaleEvidence: [],
          },
        ],
      }],
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-path" });
  });

  it("rejects repeated works and repeated path identifiers", () => {
    const repeatedWork = buildHoidCuratedReadingPathCatalogue({
      catalogueId: "repeat-work",
      revision: 1,
      paths: [{
        pathId: "repeat-work",
        title: "Invalid",
        description: "A path cannot silently revisit a work.",
        steps: [
          { stepId: "one", workId: "twok", rationale: "One", prerequisites: [], rationaleEvidence: [] },
          {
            stepId: "two",
            workId: "twok",
            rationale: "Two",
            prerequisites: [{ stepId: "one", through: reference("twok", 1) }],
            rationaleEvidence: [{ evidenceId: "evidence", reference: reference("twok", 1) }],
          },
        ],
      }],
    });
    expect(repeatedWork).toEqual({ status: "invalid", reason: "invalid-path" });

    const repeatedPath = buildHoidCuratedReadingPathCatalogue({
      catalogueId: "repeat-path",
      revision: 1,
      paths: [
        { pathId: "same-path", title: "One", description: "One", steps: [
          { stepId: "one", workId: "twok", rationale: "One", prerequisites: [], rationaleEvidence: [] },
        ] },
        { pathId: "same-path", title: "Two", description: "Two", steps: [
          { stepId: "two", workId: "wor", rationale: "Two", prerequisites: [], rationaleEvidence: [] },
        ] },
      ],
    });
    expect(repeatedPath).toEqual({ status: "invalid", reason: "duplicate-path" });
  });

  it("rejects a tampered catalogue fingerprint and non-canonical extra properties", () => {
    const catalogue = makeCatalogue();
    expect(validateHoidCuratedReadingPathCatalogue({
      ...catalogue,
      fingerprint: "0".repeat(64),
    })).toEqual({ status: "invalid", reason: "fingerprint-mismatch" });
    expect(validateHoidCuratedReadingPathCatalogue({
      ...catalogue,
      extra: true,
    })).toEqual({ status: "invalid", reason: "invalid-shape" });
  });

  it("rejects accessor-backed catalogue inputs without invoking getters", () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "catalogueId", {
      enumerable: true,
      get() {
        invoked = true;
        return "hostile";
      },
    });
    expect(buildHoidCuratedReadingPathCatalogue(hostile)).toEqual({
      status: "invalid",
      reason: "invalid-input",
    });
    expect(invoked).toBe(false);
  });
});

describe("Hoid curated reading path approval quorum", () => {
  it("builds a domain-separated signature message bound to the exact catalogue revision", () => {
    const catalogue = makeCatalogue();
    const message = buildHoidReadingPathApprovalSigningMessage({
      catalogueId: catalogue.catalogueId,
      revision: catalogue.revision,
      catalogueFingerprint: catalogue.fingerprint,
      reviewerId: "reviewer-one",
      decision: "approve",
      reviewedAt: NOW,
      keyId: "reviewer-key-one",
    });
    expect(message).toContain("hoid-curated-reading-path-catalogue-approval-ed25519-v1");
    expect(message).toContain(catalogue.fingerprint);
    expect(buildHoidReadingPathApprovalSigningMessage({
      catalogueId: catalogue.catalogueId,
      revision: catalogue.revision,
      catalogueFingerprint: "0".repeat(64),
      reviewerId: "reviewer-one",
      decision: "approve",
      reviewedAt: NOW,
      keyId: "reviewer-key-one",
    })).not.toBe(message);
  });

  it("verifies two distinct reviewer identities and key IDs through the injected Ed25519 port", async () => {
    const result = await verifyHoidCuratedReadingPathCatalogueApproval(approvalInput());
    expect(result).toMatchObject({
      status: "verified",
      registryRevision: 4,
      reviewerIds: ["reviewer-one", "reviewer-two"],
      keyIds: ["reviewer-key-one", "reviewer-key-two"],
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("requires at least two attestations", async () => {
    const input = approvalInput();
    const result = await verifyHoidCuratedReadingPathCatalogueApproval({
      ...input,
      attestations: [input.attestations[0]],
    });
    expect(result).toEqual({
      status: "invalid",
      reason: "invalid-attestations",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects duplicate reviewer identities or signing keys", async () => {
    const input = approvalInput();
    const duplicateReviewer = [
      input.attestations[0],
      { ...input.attestations[1], reviewerId: "reviewer-one" },
    ];
    expect(await verifyHoidCuratedReadingPathCatalogueApproval({
      ...input,
      attestations: duplicateReviewer,
    })).toMatchObject({ status: "invalid", reason: "invalid-attestations" });

    const duplicateKey = [
      input.attestations[0],
      { ...input.attestations[1], keyId: "reviewer-key-one" },
    ];
    expect(await verifyHoidCuratedReadingPathCatalogueApproval({
      ...input,
      attestations: duplicateKey,
    })).toMatchObject({ status: "invalid", reason: "invalid-attestations" });
  });

  it("requires both signatures to approve; a signed rejection vetoes the catalogue", async () => {
    const result = await verifyHoidCuratedReadingPathCatalogueApproval(
      approvalInput(makeCatalogue(), "reject"),
    );
    expect(result).toMatchObject({
      status: "rejected",
      reviewerIds: ["reviewer-one", "reviewer-two"],
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("fails closed when cryptographic verification is unavailable", async () => {
    const input = approvalInput();
    const result = await verifyHoidCuratedReadingPathCatalogueApproval({
      ...input,
      verifier: { verify: async () => { throw new Error("crypto unavailable"); } },
    });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "trust-verification-failed",
    });
  });

  it("rejects a signature envelope that is not a 64-byte Ed25519 signature", async () => {
    const input = approvalInput();
    expect(await verifyHoidCuratedReadingPathCatalogueApproval({
      ...input,
      attestations: [
        { ...input.attestations[0], signatureHex: "bad" },
        input.attestations[1],
      ],
    })).toMatchObject({ status: "invalid", reason: "invalid-attestations" });
  });
});

describe("Hoid curated reading path recommendations", () => {
  it("returns no-curated-paths without invoking the verifier while the production catalogue is empty", async () => {
    const verify = vi.fn(async () => true);
    const result = await evaluateHoidCuratedReadingPathRecommendations({
      ...approvalInput(HOID_CURATED_READING_PATH_CATALOGUE ?? makeCatalogue()),
      catalogue: HOID_CURATED_READING_PATH_CATALOGUE,
      progressSnapshot: makeProgress({ kind: "empty" }),
      verifier: { verify },
    });
    expect(result).toMatchObject({ status: "no-curated-paths" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("recommends only the first step of a signed path and requires manual reader selection", async () => {
    const catalogue = makeCatalogue();
    const result = await evaluateHoidCuratedReadingPathRecommendations(
      evaluationInput(makeProgress({ kind: "empty" }), catalogue),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.plan.recommendations).toEqual([expect.objectContaining({
      pathId: "synthetic-roshar-path",
      stepId: "start-twok",
      workId: "twok",
      workTitle: "El Camino de los Reyes",
      navigation: "manual-reader-selection-required",
    })]);
    expect(result.plan.recommendations[0]).not.toHaveProperty("reference");
    expect(result.plan.recommendations[0]).not.toHaveProperty("chapterNumber");
    expect(result.plan.recommendations[0]).not.toHaveProperty("locatorId");
  });

  it("does not recommend a later step until the exact prerequisite chapter is completed", async () => {
    const catalogue = makeCatalogue();
    const stillReadingChapterTwo = makeProgress({
      kind: "cursor",
      bookId: "twok",
      chapterNumber: 2,
    });
    const result = await evaluateHoidCuratedReadingPathRecommendations(
      evaluationInput(stillReadingChapterTwo, catalogue),
    );
    expect(result).toMatchObject({
      status: "no-eligible-next-work",
      reason: "prerequisites-incomplete",
    });
  });

  it("recommends the next work only after the prerequisite's exact ordinal is completed", async () => {
    const catalogue = makeCatalogue();
    const afterChapterTwo = makeProgress({
      kind: "cursor",
      bookId: "twok",
      chapterNumber: 3,
    });
    const result = await evaluateHoidCuratedReadingPathRecommendations(
      evaluationInput(afterChapterTwo, catalogue),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.plan.recommendations[0]).toMatchObject({
      stepId: "continue-wor",
      workId: "wor",
      workTitle: "Palabras radiantes",
      navigation: "manual-reader-selection-required",
    });
  });

  it("accepts an explicitly completed prerequisite work", async () => {
    const catalogue = makeCatalogue();
    const result = await evaluateHoidCuratedReadingPathRecommendations(
      evaluationInput(makeProgress({ kind: "completed", bookId: "twok" }), catalogue),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.plan.recommendations[0].workId).toBe("wor");
  });

  it("does not recommend a target work that is already in progress", async () => {
    const catalogue = makeCatalogue();
    const result = await evaluateHoidCuratedReadingPathRecommendations(
      evaluationInput(makeProgress({
        kind: "cursor",
        bookId: "twok",
        chapterNumber: 3,
      }), catalogue),
    );
    expect(result).toMatchObject({
      status: "no-eligible-next-work",
      reason: "path-step-in-progress",
    });
  });

  it("reports a completed path without inventing another work", async () => {
    const catalogue = makeCatalogue();
    const result = await evaluateHoidCuratedReadingPathRecommendations(
      evaluationInput(makeProgress({ kind: "two-completed" }), catalogue),
    );
    expect(result).toMatchObject({
      status: "no-eligible-next-work",
      reason: "all-paths-completed",
    });
  });

  it("blocks a catalogue when any reviewer rejects it", async () => {
    const catalogue = makeCatalogue();
    const result = await evaluateHoidCuratedReadingPathRecommendations(
      evaluationInput(makeProgress({ kind: "empty" }), catalogue, "reject"),
    );
    expect(result).toMatchObject({ status: "blocked", reason: "approval-rejected" });
  });

  it("revalidates the exact catalogue, quorum and progress before presenting a saved plan", async () => {
    const catalogue = makeCatalogue();
    const progress = makeProgress({ kind: "cursor", bookId: "twok", chapterNumber: 3 });
    const input = evaluationInput(progress, catalogue);
    const evaluated = await evaluateHoidCuratedReadingPathRecommendations(input);
    expect(evaluated.status).toBe("ready");
    if (evaluated.status !== "ready") return;

    expect(await validateHoidCuratedReadingPathRecommendationPlan({
      ...input,
      plan: evaluated.plan,
    })).toMatchObject({ status: "valid" });

    const changedProgress = makeProgress({ kind: "cursor", bookId: "twok", chapterNumber: 4 }, 2);
    expect(await validateHoidCuratedReadingPathRecommendationPlan({
      ...evaluationInput(changedProgress, catalogue),
      plan: evaluated.plan,
    })).toEqual({ status: "invalid", reason: "stale-or-tampered-plan" });
  });

  it("rejects accessor-backed saved plans without invoking getters", async () => {
    const catalogue = makeCatalogue();
    const progress = makeProgress({ kind: "empty" });
    let invoked = false;
    const hostile = Object.defineProperty({}, "fingerprint", {
      enumerable: true,
      get() {
        invoked = true;
        return "0".repeat(64);
      },
    });
    const result = await validateHoidCuratedReadingPathRecommendationPlan({
      ...evaluationInput(progress, catalogue),
      plan: hostile,
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-plan" });
    expect(invoked).toBe(false);
  });
});

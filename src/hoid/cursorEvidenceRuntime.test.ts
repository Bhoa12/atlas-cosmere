import { describe, expect, it, vi } from "vitest";
import { createHoidEvidenceRuntime, type HoidApprovedClaim, type HoidClaimSelectionRequest, type HoidClaimSelectionContext } from "./evidenceRuntime";
import { createHoidClaimSelectionResponse } from "./selectionProtocol";
import {
  createHoidCursorEvidenceRuntime,
  projectHoidCursorProgressSnapshot,
} from "./cursorEvidenceRuntime";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import type { HoidKnowledgeEntry } from "./catalog";
import { createHoidApprovedClaimAttestation, type HoidApprovedClaimCore } from "./approvedClaimIntegrity";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador de prueba no disponible");
  return unit.locatorId;
}

const updatedAt = "2026-11-17T00:00:00.000Z";

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-alpha",
    aliases: ["Personaje Alfa"],
    kind: "character",
    firstSafeAppearance: { bookId: "twok", chapter: 2 },
    evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
    evidenceUnlock: { bookId: "twok", chapter: 2 },
    provenance: "verified",
    summary: "Resumen editorial sintético de prueba sobre Personaje Alfa.",
  },
  {
    id: "e-beta",
    aliases: ["Personaje Beta"],
    kind: "character",
    firstSafeAppearance: { bookId: "edgedancer", chapter: 3 },
    evidenceSource: { bookId: "edgedancer", chapter: 3, locatorId: locator("edgedancer", 3) },
    evidenceUnlock: { bookId: "edgedancer", chapter: 3 },
    provenance: "verified",
    summary: "Resumen editorial sintético de prueba sobre Personaje Beta.",
  },
];

const reviewer = Object.freeze({
  reviewerId: "cursor-runtime-test",
  reviewedAt: "2026-11-17T00:00:00.000Z",
});

function approvedClaim(core: HoidApprovedClaimCore): HoidApprovedClaim {
  const attestation = createHoidApprovedClaimAttestation(core, knowledge, reviewer);
  if (attestation.status !== "valid") throw new Error("Cursor fixture claim attestation failed: " + attestation.reason);
  return Object.freeze({ ...core, integrity: attestation.integrity, review: attestation.review });
}

const claims: HoidApprovedClaim[] = [
  approvedClaim({
    id: "claim-alpha",
    text: "Afirmación editorial sintética sobre Personaje Alfa.",
    intent: "explain",
    evidenceIds: ["e-alpha"],
    entityIds: ["e-alpha"],
  }),
  approvedClaim({
    id: "claim-cross-book",
    text: "Relación sintética que requiere las dos evidencias.",
    intent: "explain",
    evidenceIds: ["e-alpha", "e-beta"],
    entityIds: ["e-alpha", "e-beta"],
  }),
];

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor de prueba no disponible");
  return result.cursor;
}

function snapshot(
  positions: readonly Record<string, unknown>[],
  revision = positions.length === 0 ? 0 : 1,
) {
  return {
    schemaVersion: 2,
    revision,
    positions,
    updatedAt: revision === 0 ? null : updatedAt,
  };
}

function selectorAdapter(
  selectClaims: (
    request: HoidClaimSelectionRequest,
    context: HoidClaimSelectionContext,
  ) => Promise<unknown>,
) {
  return {
    selectClaims: async (
      request: HoidClaimSelectionRequest,
      context: HoidClaimSelectionContext,
    ) => {
      const result = await selectClaims(request, context);
      return Array.isArray(result) && result.every(item => typeof item === "string")
        ? createHoidClaimSelectionResponse(request, result as string[])
        : result;
    },
  };
}

function createFacade(selector = vi.fn(async (_request: HoidClaimSelectionRequest) => ["claim-alpha"])) {
  const runtime = createHoidEvidenceRuntime({ knowledge, claims, selector: selectorAdapter(selector) });
  if (runtime === null) throw new Error("No se pudo crear el runtime de prueba");
  return { facade: createHoidCursorEvidenceRuntime(runtime), selector };
}

describe("HoidCursorEvidenceRuntime", () => {
  it("projects only validated edition-bound cursors and explicit completion", () => {
    const result = projectHoidCursorProgressSnapshot(snapshot([
      { bookId: "twok", cursor: cursor("twok", 2), order: 4 },
      { bookId: "woa", completed: true, order: 5 },
    ], 2));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.revision).toBe(2);
    expect(result.reading).toEqual([
      { bookId: "twok", chapter: 1, order: 4 },
      { bookId: "woa", completed: true, order: 5 },
    ]);
    expect(result.startedBookIds).toEqual(["twok", "woa"]);
  });

  it("does not unlock a summary from the chapter currently open in Atlas", async () => {
    const { facade, selector } = createFacade();
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 2) }]),
    });

    expect(result.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();
  });

  it("unlocks a chapter-two summary only after chapter two is no longer the open chapter", async () => {
    const { facade, selector } = createFacade();

    const whileChapterTwoIsOpen = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 2) }]),
    });
    expect(whileChapterTwoIsOpen.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();

    const afterAdvancingToChapterThree = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 3) }]),
    });
    expect(afterAdvancingToChapterThree.status).toBe("authorized");
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("authorizes an explanation only after validating the cursor manifest", async () => {
    const { facade, selector } = createFacade();
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 3) }]),
    });

    expect(result.status).toBe("authorized");
    expect(result.claimIds).toEqual(["claim-alpha"]);
    expect(result.text).toBe("Afirmación editorial sintética sobre Personaje Alfa.");
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("forwards the closed selection budget only after validating the cursor snapshot", async () => {
    const { facade, selector } = createFacade();
    const selectionBudget = Object.freeze({
      maxClaims: 3,
      maxEvidence: 4,
      maxWorks: 2,
      maxCharacters: 6_000,
      minimumWorks: 1,
      requireSegmentProvenance: true,
      requireCrossWorkSegment: false,
    });
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 3) }]),
      selectionBudget,
    });

    expect(result.status).toBe("authorized");
    expect(selector).toHaveBeenCalledWith(
      expect.objectContaining({ selectionBudget }),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("requires every cross-work cursor before invoking the selector", async () => {
    const selector = vi.fn(async () => ["claim-cross-book"]);
    const runtime = createHoidEvidenceRuntime({ knowledge, claims: [claims[1]], selector: selectorAdapter(selector) });
    if (runtime === null) throw new Error("No se pudo crear el runtime de prueba");
    const facade = createHoidCursorEvidenceRuntime(runtime);

    const locked = await facade.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 3) }]),
    });
    expect(locked.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();

    const unlocked = await facade.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      progress: snapshot([
        { bookId: "twok", cursor: cursor("twok", 3) },
        { bookId: "edgedancer", cursor: cursor("edgedancer", 4) },
      ], 2),
    });
    expect(unlocked.status).toBe("authorized");
    expect(unlocked.claimIds).toEqual(["claim-cross-book"]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("rejects an obsolete edition digest before provider invocation", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const { facade } = createFacade(selector);
    const stale = { ...cursor("twok", 2), manifestId: "hoid:obsolete-edition" };
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: stale }]),
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects a forged cursor beyond the verified prefix of an ambiguous edition", async () => {
    const manifest = getHoidReadingManifest("elantris");
    if (manifest.status !== "ready") throw new Error("Manifiesto de prueba no disponible");
    const forged = {
      schemaVersion: 1,
      manifestId: manifest.manifest.manifestId,
      bookId: "elantris",
      unitId: "chapter:048",
      ordinal: 48,
      chapterNumber: 48,
    };
    const { facade, selector } = createFacade();
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "elantris", cursor: forged }]),
    });

    expect(result.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects malformed snapshots and does not call the selector", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const { facade } = createFacade(selector);
    const invalid = snapshot([{ bookId: "twok", cursor: cursor("twok", 2) }]);
    (invalid as Record<string, unknown>).extra = true;

    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: invalid,
    });
    expect(result.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects accessor-bearing requests without executing the accessor", async () => {
    const { facade, selector } = createFacade();
    let invoked = false;
    const input = {
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 2) }]),
    };
    Object.defineProperty(input, "question", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "¿Quién es Personaje Alfa?";
      },
    });

    const result = await facade.answer(input);
    expect(result.status).toBe("blocked");
    expect(invoked).toBe(false);
    expect(selector).not.toHaveBeenCalled();
  });

  it("keeps recommendations metadata-only and rejects invalid cursor progress", () => {
    const { facade } = createFacade();
    const recommendations = facade.recommend(snapshot([
      { bookId: "twok", cursor: cursor("twok", 1) },
    ]), 3);

    expect(recommendations.status).toBe("ready");
    if (recommendations.status === "ready") {
      expect(recommendations.items[0]).toEqual({
        sourceId: "twok",
        title: "El Camino de los Reyes",
        reason: "resume-current-work",
        currentChapter: 1,
        completedThroughChapter: null,
      });
      expect(recommendations.items.slice(1).every(item => item.reason === "unread-source")).toBe(true);
    }

    const invalid = facade.recommend(null);
    expect(invalid.status).toBe("abstain");
    if (invalid.status === "abstain") expect(invalid.reason).toBe("invalid-progress");
  });

  it("rejects invalid recommendation limits", () => {
    const { facade } = createFacade();
    const progress = snapshot([{ bookId: "twok", cursor: cursor("twok", 1) }]);
    expect(facade.recommend(progress, -1).status).toBe("abstain");
    expect(facade.recommend(progress, 1.5).status).toBe("abstain");
    expect(facade.recommend(progress, 21).status).toBe("abstain");
  });

  it("rejects unknown request fields rather than forwarding hidden context", async () => {
    const { facade, selector } = createFacade();
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 2) }]),
      knowledgeContext: [{ id: "injected", text: "spoiler" }],
    });
    expect(result.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();
  });

  it("forwards the validated entity scope through the cursor-native facade", async () => {
    const selector = vi.fn(async (request: HoidClaimSelectionRequest) => {
      expect(request.candidates.map(candidate => candidate.id)).toEqual(["claim-cross-book"]);
      return ["claim-cross-book"];
    });
    const runtime = createHoidEvidenceRuntime({ knowledge, claims, selector: selectorAdapter(selector) });
    if (runtime === null) throw new Error("No se pudo crear el runtime de prueba");
    const facade = createHoidCursorEvidenceRuntime(runtime);
    const progress = snapshot([
      { bookId: "twok", cursor: cursor("twok", 3), order: 1 },
      { bookId: "edgedancer", cursor: cursor("edgedancer", 4), order: 2 },
    ], 2);

    const result = await facade.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      progress,
      entityIds: ["e-alpha", "e-beta"],
    });

    expect(result.status).toBe("authorized");
    expect(result.claimIds).toEqual(["claim-cross-book"]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("forwards caller cancellation through the cursor-native facade", async () => {
    const controller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    const selector = vi.fn(async (
      _request: HoidClaimSelectionRequest,
      context: HoidClaimSelectionContext,
    ) => {
      providerSignal = context.signal;
      return new Promise<unknown>(() => {});
    });
    const { facade } = createFacade(selector);
    const pending = facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 3) }]),
    }, { signal: controller.signal });

    await Promise.resolve();
    expect(providerSignal).toBeDefined();
    controller.abort();
    const result = await pending;

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("request-cancelled");
    expect(providerSignal?.aborted).toBe(true);
  });

  it("forwards a validated explicit book scope through the cursor-native facade", async () => {
    const selector = vi.fn(async (request: HoidClaimSelectionRequest) => {
      expect(request.candidates.map(candidate => candidate.id)).toEqual(["claim-alpha"]);
      return ["claim-alpha"];
    });
    const { facade } = createFacade(selector);
    const result = await facade.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      progress: snapshot([
        { bookId: "twok", cursor: cursor("twok", 3) },
        { bookId: "edgedancer", cursor: cursor("edgedancer", 4) },
      ], 2),
      bookScope: { mode: "single-work", bookIds: ["twok"] },
    });
    expect(result.status).toBe("authorized");
    expect(result.claimIds).toEqual(["claim-alpha"]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid book scope at the cursor facade before selector invocation", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const { facade } = createFacade(selector);
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress: snapshot([{ bookId: "twok", cursor: cursor("twok", 3) }]),
      bookScope: { mode: "single-work", bookIds: ["unknown-work"] },
    });
    expect(result.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();
  });

  it("binds an authorized answer to the exact validated cursor snapshot", async () => {
    const { facade } = createFacade();
    const progress = snapshot([{ bookId: "twok", cursor: cursor("twok", 3) }], 7);
    const projection = projectHoidCursorProgressSnapshot(progress);
    if (projection.status !== "ready") throw new Error("Projection unavailable");
    const result = await facade.answer({
      question: "¿Quién es Personaje Alfa?",
      progress,
    });

    expect(result.status).toBe("authorized");
    expect(result.progressBinding).toEqual({
      schemaVersion: 1,
      revision: 7,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });


});

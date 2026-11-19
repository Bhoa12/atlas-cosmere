import { describe, expect, it, vi } from "vitest";
import { createHoidEvidenceRuntime, type HoidApprovedClaim } from "./evidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { presentHoidEvidenceAnswer } from "./answerPresentation";
import { createHoidApprovedClaimAttestation, type HoidApprovedClaimCore } from "./approvedClaimIntegrity";

const updatedAt = "2026-11-19T07:00:00.000Z";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Test manifest unavailable");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Test locator unavailable");
  return unit.locatorId;
}

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Test cursor unavailable");
  return result.cursor;
}

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-alpha",
    aliases: ["Personaje Alfa"],
    kind: "character",
    firstSafeAppearance: { bookId: "twok", chapter: 2 },
    evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
    evidenceUnlock: { bookId: "twok", chapter: 2 },
    provenance: "verified",
    summary: "Resumen sintético de prueba para Personaje Alfa.",
  },
  {
    id: "e-beta",
    aliases: ["Personaje Beta"],
    kind: "character",
    firstSafeAppearance: { bookId: "edgedancer", chapter: 3 },
    evidenceSource: { bookId: "edgedancer", chapter: 3, locatorId: locator("edgedancer", 3) },
    evidenceUnlock: { bookId: "edgedancer", chapter: 3 },
    provenance: "verified",
    summary: "Resumen sintético de prueba para Personaje Beta.",
  },
];

const reviewer = Object.freeze({
  reviewerId: "synthetic-reviewer",
  reviewedAt: "2026-11-18T12:00:00.000Z",
});

function approvedClaim(
  core: HoidApprovedClaimCore,
  sourceKnowledge: readonly HoidKnowledgeEntry[] = knowledge,
): HoidApprovedClaim {
  const attestation = createHoidApprovedClaimAttestation(core, sourceKnowledge, reviewer);
  if (attestation.status !== "valid") throw new Error("Synthetic claim attestation failed: " + attestation.reason);
  return Object.freeze({ ...core, integrity: attestation.integrity, review: attestation.review });
}

const claims: HoidApprovedClaim[] = [
  approvedClaim({
    id: "claim-alpha",
    text: "Afirmación editorial sintética sobre Personaje Alfa.",
    intent: "explain",
    evidenceIds: ["e-alpha"],
  }),
  approvedClaim({
    id: "claim-beta",
    text: "Afirmación editorial sintética sobre Personaje Beta.",
    intent: "explain",
    evidenceIds: ["e-beta"],
  }),
];

function progress(openChapterA: number, openChapterB: number) {
  return Object.freeze({
    schemaVersion: 2,
    revision: 7,
    positions: Object.freeze([
      Object.freeze({ bookId: "twok", cursor: cursor("twok", openChapterA) }),
      Object.freeze({ bookId: "edgedancer", cursor: cursor("edgedancer", openChapterB) }),
    ]),
    updatedAt,
  });
}

describe("Hoid per-claim evidence provenance", () => {
  it("preserves exact approved claim text and maps each segment to its own work/chapter citations", async () => {
    const selector = vi.fn(async () => ["claim-beta", "claim-alpha"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge,
      claims,
      selector: { selectClaims: selector },
    });
    expect(runtime).not.toBeNull();

    const answer = await runtime!.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      reading: [
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 3 },
      ],
    });

    expect(answer.status).toBe("authorized");
    if (answer.status !== "authorized") return;
    expect(answer.text).toBe(claims.map(claim => claim.text).join("\n\n"));
    expect(answer.layout).toBe("plain");
    expect(answer.segments).toEqual([
      { claimId: "claim-alpha", text: claims[0].text, evidenceIds: ["e-alpha"] },
      { claimId: "claim-beta", text: claims[1].text, evidenceIds: ["e-beta"] },
    ]);

    const presentation = presentHoidEvidenceAnswer(answer, progress(3, 4));
    expect(presentation.status).toBe("ready");
    if (presentation.status !== "ready") return;
    expect(presentation.segments?.map(segment => ({
      claimId: segment.claimId,
      evidenceIds: segment.evidenceIds,
      citations: segment.citations.map(citation => ({
        sourceBookId: citation.sourceBookId,
        chapter: citation.chapter,
      })),
    }))).toEqual([
      { claimId: "claim-alpha", evidenceIds: ["e-alpha"], citations: [{ sourceBookId: "twok", chapter: 2 }] },
      { claimId: "claim-beta", evidenceIds: ["e-beta"], citations: [{ sourceBookId: "edgedancer", chapter: 3 }] },
    ]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the selector when one referenced work has not crossed its own cursor boundary", async () => {
    const selector = vi.fn(async () => ["claim-alpha", "claim-beta"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge,
      claims,
      selector: { selectClaims: selector },
    });
    const answer = await runtime!.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      reading: [
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ],
    });
    expect(answer.status).toBe("blocked");
    expect(selector).not.toHaveBeenCalled();
  });

  it("abstains rather than silently dropping evidence when a response exceeds the presentation evidence budget", async () => {
    const manyKnowledge: HoidKnowledgeEntry[] = Array.from({ length: 17 }, (_, index) => ({
      id: "evidence-" + String(index + 1),
      aliases: ["Concepto Alfa"],
      kind: "concept",
      firstSafeAppearance: { bookId: "twok", chapter: 2 },
      evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
      evidenceUnlock: { bookId: "twok", chapter: 2 },
      provenance: "verified",
      summary: "Resumen sintético de prueba " + String(index + 1) + ".",
    }));
    const manyClaims: HoidApprovedClaim[] = [
      approvedClaim({
        id: "claim-one",
        text: "Primera afirmación sintética.",
        intent: "explain",
        evidenceIds: manyKnowledge.slice(0, 9).map(item => item.id),
      }, manyKnowledge),
      approvedClaim({
        id: "claim-two",
        text: "Segunda afirmación sintética.",
        intent: "explain",
        evidenceIds: manyKnowledge.slice(9).map(item => item.id),
      }, manyKnowledge),
    ];
    const runtime = createHoidEvidenceRuntime({
      knowledge: manyKnowledge,
      claims: manyClaims,
      selector: { selectClaims: async () => ["claim-one", "claim-two"] },
    });
    expect(runtime).not.toBeNull();
    const answer = await runtime!.answer({
      question: "¿Qué sabes de Concepto Alfa?",
      reading: [{ bookId: "twok", chapter: 2 }],
    });
    expect(answer.status).toBe("blocked");
    expect(answer.reason).toBe("invalid-selection");
    expect(answer.text).not.toContain("Primera afirmación");
    expect(answer.text).not.toContain("Segunda afirmación");
  });
});

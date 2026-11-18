import { describe, expect, it } from "vitest";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import { composeHoidTopicRecommendations, composeProductionHoidTopicRecommendations } from "./topicRecommendations";

const UPDATED_AT = "2026-11-18T10:00:00.000Z";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor sintético no disponible");
  return result.cursor;
}

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  return unit.locatorId;
}

function progress(positions: readonly { bookId: string; chapter: number }[]) {
  return {
    schemaVersion: 2,
    revision: 9,
    positions: positions.map(item => ({
      bookId: item.bookId,
      cursor: cursor(item.bookId, item.chapter),
    })),
    updatedAt: positions.length ? UPDATED_AT : null,
  };
}

function answer(claimId: string, text: string, sourceBookId = "wor") {
  const evidenceId = "evidence." + claimId;
  return {
    status: "authorized",
    text,
    claimIds: [claimId],
    evidenceIds: [evidenceId],
    sources: [{
      evidenceId,
      sourceBookId,
      sourceChapter: 1,
      locatorId: locator(sourceBookId, 1),
      unlockBookId: sourceBookId,
      unlockChapter: 2,
    }],
    layout: "plain",
    segments: [{ claimId, text, evidenceIds: [evidenceId] }],
  };
}

function assignment(
  workId: string,
  topicId: string,
  dimensionId: string,
  claimId: string,
  text: string,
  sourceBookId = "wor",
) {
  return {
    schemaVersion: 1,
    id: "assignment." + workId + "." + topicId,
    subjectKind: "work",
    subjectId: workId,
    worldId: "world-alpha",
    worldLabel: "Mundo Alfa",
    topicId,
    dimensionId,
    claimId,
    claimTextSha256: sha256Hex(text),
    evidenceIds: ["evidence." + claimId],
    review: {
      status: "approved",
      reviewerId: "reviewer-1",
      reviewedAt: "2026-11-18T10:00:00.000Z",
    },
  };
}

function approvedClaims(pairs: readonly { claimId: string; answer: ReturnType<typeof answer> }[]) {
  const byId = new Map<string, { id: string; text: string; evidenceIds: readonly string[] }>();
  for (const pair of pairs) {
    byId.set(pair.claimId, {
      id: pair.claimId,
      text: pair.answer.text,
      evidenceIds: pair.answer.evidenceIds,
    });
  }
  return [...byId.values()];
}

describe("Hoid topic-aware safe recommendations", () => {
  it("recommends an unstarted work only when its reviewed association is supported by unlocked evidence elsewhere", () => {
    const text = "Asociación temática sintética respaldada por una fuente ya leída.";
    const claimId = "claim.tfe.investiture";
    const pairs = [{ claimId, answer: answer(claimId, text) }];
    const result = composeHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 3 }]),
      pairs,
      5,
      [assignment("tfe", "investiture-system", "mechanism", claimId, text)],
      approvedClaims(pairs),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items[0].sourceId).toBe("tfe");
    expect(result.items[0].matches[0].reasonText).toBe(text);
    expect(result.items[0].matches[0].citations[0].sourceBookId).toBe("wor");
  });

  it("withholds a recommendation when the supporting source has not reached its unlock boundary", () => {
    const text = "Asociación temática sintética.";
    const claimId = "claim.tfe.locked";
    const pairs = [{ claimId, answer: answer(claimId, text) }];
    const result = composeHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 1 }]),
      pairs,
      5,
      [assignment("tfe", "investiture-system", "mechanism", claimId, text)],
      approvedClaims(pairs),
    );
    expect(result).toEqual({ status: "none", reason: "no-safe-reviewed-matches" });
  });

  it("never uses an unread candidate's own locked chapter as a recommendation rationale", () => {
    const text = "Asociación sintética procedente de la propia obra.";
    const claimId = "claim.tfe.self";
    const pairs = [{ claimId, answer: answer(claimId, text, "tfe") }];
    const result = composeHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 3 }]),
      pairs,
      5,
      [assignment("tfe", "investiture-system", "mechanism", claimId, text, "tfe")],
      approvedClaims(pairs),
    );
    expect(result).toEqual({ status: "none", reason: "no-safe-reviewed-matches" });
  });

  it("does not recommend a work that is already started or completed", () => {
    const text = "Asociación temática sintética.";
    const claimId = "claim.tfe.started";
    const pairs = [{ claimId, answer: answer(claimId, text) }];
    const result = composeHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 3 }, { bookId: "tfe", chapter: 2 }]),
      pairs,
      5,
      [assignment("tfe", "investiture-system", "mechanism", claimId, text)],
      approvedClaims(pairs),
    );
    expect(result).toEqual({ status: "none", reason: "no-safe-reviewed-matches" });
  });

  it("ranks candidates by explicit selected-topic order, not inferred similarity or reading history", () => {
    const firstText = "Asociación organizativa sintética.";
    const secondText = "Asociación de Investidura sintética.";
    const firstId = "claim.tfe.organization";
    const secondId = "claim.elantris.investiture";
    const pairs = [
      { claimId: firstId, answer: answer(firstId, firstText) },
      { claimId: secondId, answer: answer(secondId, secondText) },
    ];
    const result = composeHoidTopicRecommendations(
      ["investiture-system", "organization"],
      progress([{ bookId: "wor", chapter: 3 }]),
      pairs,
      5,
      [
        assignment("tfe", "organization", "membership", firstId, firstText),
        assignment("elantris", "investiture-system", "mechanism", secondId, secondText),
      ],
      approvedClaims(pairs),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items.map(item => item.sourceId)).toEqual(["elantris", "tfe"]);
  });

  it("returns a neutral empty result when the reader has not explicitly selected topics", () => {
    expect(composeHoidTopicRecommendations([], progress([{ bookId: "wor", chapter: 3 }]), [], 5, []))
      .toEqual({ status: "none", reason: "no-selected-topics" });
  });

  it("rejects unknown topic IDs, malformed progress and invalid limits", () => {
    expect(composeHoidTopicRecommendations(["unknown-topic"], progress([{ bookId: "wor", chapter: 3 }]), [], 5, []).status)
      .toBe("invalid");
    expect(composeHoidTopicRecommendations(["investiture-system"], { corrupt: true }, [], 5, []))
      .toEqual({ status: "invalid", reason: "invalid-progress" });
    expect(composeHoidTopicRecommendations(["investiture-system"], progress([{ bookId: "wor", chapter: 3 }]), [], 0, []))
      .toEqual({ status: "invalid", reason: "invalid-input" });
  });

  it("rejects duplicate answer IDs and assignment digests that differ from the approved claim", () => {
    const text = "Asociación sintética.";
    const claimId = "claim.tfe.bad";
    const pairs = [
      { claimId, answer: answer(claimId, text) },
      { claimId, answer: answer(claimId, text) },
    ];
    const assignmentRecord = assignment("tfe", "investiture-system", "mechanism", claimId, text);
    expect(composeHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 3 }]),
      pairs,
      5,
      [assignmentRecord],
      approvedClaims(pairs),
    )).toEqual({ status: "invalid", reason: "invalid-answers" });

    const mismatched = { ...assignmentRecord, claimTextSha256: sha256Hex("Otro texto.") };
    const singlePair = [{ claimId, answer: answer(claimId, text) }];
    expect(composeHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 3 }]),
      singlePair,
      5,
      [mismatched],
      approvedClaims(singlePair),
    )).toEqual({ status: "invalid", reason: "invalid-assignments" });
  });

  it("rejects an answer whose wording does not match the approved claim even when its source is unlocked", () => {
    const approvedText = "Texto aprobado.";
    const alteredText = "Texto alterado.";
    const claimId = "claim.tfe.altered";
    const pairs = [{ claimId, answer: answer(claimId, alteredText) }];
    expect(composeHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 3 }]),
      pairs,
      5,
      [assignment("tfe", "investiture-system", "mechanism", claimId, approvedText)],
      [{ id: claimId, text: approvedText, evidenceIds: ["evidence." + claimId] }],
    )).toEqual({ status: "invalid", reason: "invalid-answers" });
  });

  it("uses the empty production registry until approved topic assignments are committed", () => {
    expect(composeProductionHoidTopicRecommendations(
      ["investiture-system"],
      progress([{ bookId: "wor", chapter: 3 }]),
      [],
      5,
    )).toEqual({ status: "none", reason: "no-safe-reviewed-matches" });
  });
});

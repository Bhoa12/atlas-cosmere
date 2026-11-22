import { describe, expect, it } from "vitest";
import { presentHoidEvidenceAnswer } from "./answerPresentation";
import {
  buildHoidCrossBookEvidenceSummary,
  summarizeHoidPresentedCrossBookEvidence,
} from "./crossBookEvidence";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";

const UPDATED_AT = "2026-11-18T10:00:00.000Z";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor sintético no disponible");
  return result.cursor;
}

function locator(bookId: string, chapter: number): string {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = manifest.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  return unit.locatorId;
}

function source(bookId: string, evidenceId: string, chapter = 1) {
  return {
    evidenceId,
    sourceBookId: bookId,
    sourceChapter: chapter,
    locatorId: locator(bookId, chapter),
    unlockBookId: bookId,
    unlockChapter: chapter + 1,
  };
}

function progress(includeWor = true, tfeChapter = 3) {
  const positions: { bookId: string; cursor: ReturnType<typeof cursor> }[] = [
    { bookId: "tfe", cursor: cursor("tfe", tfeChapter) },
  ];
  if (includeWor) positions.push({ bookId: "wor", cursor: cursor("wor", 3) });
  return {
    schemaVersion: 2,
    revision: 4,
    positions,
    updatedAt: UPDATED_AT,
  };
}

function answer(overrides: Record<string, unknown> = {}): HoidEvidenceAnswer {
  const tfe = source("tfe", "evidence.tfe");
  const wor = source("wor", "evidence.wor");
  return {
    status: "authorized",
    text: "Afirmación respaldada por TFE.\n\nAfirmación respaldada por WoR.",
    claimIds: ["claim.tfe", "claim.wor"],
    evidenceIds: ["evidence.tfe", "evidence.wor"],
    sources: [tfe, wor],
    layout: "plain",
    segments: [
      { claimId: "claim.tfe", text: "Afirmación respaldada por TFE.", evidenceIds: ["evidence.tfe"] },
      { claimId: "claim.wor", text: "Afirmación respaldada por WoR.", evidenceIds: ["evidence.wor"] },
    ],
    ...overrides,
  };
}

describe("buildHoidCrossBookEvidenceSummary", () => {
  it("groups independently unlocked sources by work and preserves per-segment mapping", () => {
    const result = buildHoidCrossBookEvidenceSummary(answer(), progress());
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.summary.workCount).toBe(2);
    expect(result.summary.works).toEqual([
      { sourceBookId: "tfe", title: "El Imperio Final", chapters: [1], evidenceIds: ["evidence.tfe"] },
      { sourceBookId: "wor", title: "Palabras radiantes", chapters: [1], evidenceIds: ["evidence.wor"] },
    ]);
    expect(result.summary.segments).toEqual([
      { claimId: "claim.tfe", sourceBookIds: ["tfe"] },
      { claimId: "claim.wor", sourceBookIds: ["wor"] },
    ]);
  });

  it("does not disclose a cross-book summary when one work has not reached its own unlock threshold", () => {
    const result = buildHoidCrossBookEvidenceSummary(answer(), progress(false));
    expect(result).toEqual({ status: "unavailable", reason: "answer-not-authorized" });
  });

  it("returns not-cross-book for a fully authorized single-work answer", () => {
    const tfe = source("tfe", "evidence.tfe");
    const single: HoidEvidenceAnswer = {
      status: "authorized",
      text: "Afirmación de una sola obra.",
      claimIds: ["claim.single"],
      evidenceIds: ["evidence.tfe"],
      sources: [tfe],
      layout: "plain",
      segments: [{ claimId: "claim.single", text: "Afirmación de una sola obra.", evidenceIds: ["evidence.tfe"] }],
    };
    expect(buildHoidCrossBookEvidenceSummary(single, progress())).toEqual({ status: "not-cross-book" });
  });

  it("rejects a segment whose evidence mapping differs from its citations", () => {
    const invalid = answer({
      segments: [
        { claimId: "claim.tfe", text: "Afirmación respaldada por TFE.", evidenceIds: ["evidence.wor"] },
        { claimId: "claim.wor", text: "Afirmación respaldada por WoR.", evidenceIds: ["evidence.wor"] },
      ],
    });
    expect(buildHoidCrossBookEvidenceSummary(invalid, progress())).toMatchObject({
      status: "unavailable",
      reason: "answer-not-authorized",
    });
  });

  it("rejects a source from an unknown work at the presentation boundary", () => {
    const unknown = {
      ...source("tfe", "evidence.unknown"),
      sourceBookId: "unknown-work",
      unlockBookId: "unknown-work",
    };
    const invalid = answer({
      evidenceIds: ["evidence.unknown"],
      sources: [unknown],
      segments: [{ claimId: "claim.unknown", text: "Afirmación.", evidenceIds: ["evidence.unknown"] }],
      claimIds: ["claim.unknown"],
      text: "Afirmación.",
    });
    expect(buildHoidCrossBookEvidenceSummary(invalid, progress())).toMatchObject({
      status: "unavailable",
      reason: "answer-not-authorized",
    });
  });

  it("rejects a segment-provenance-free answer for cross-book grouping", () => {
    const legacy = answer();
    delete (legacy as unknown as Record<string, unknown>).segments;
    delete (legacy as unknown as Record<string, unknown>).layout;
    expect(buildHoidCrossBookEvidenceSummary(legacy, progress())).toMatchObject({
      status: "unavailable",
      reason: "segment-provenance-required",
    });
  });

  it("groups multiple chapters from the same work once and sorts chapters", () => {
    const first = source("tfe", "evidence.tfe.one", 1);
    const second = source("tfe", "evidence.tfe.two", 2);
    const other = source("wor", "evidence.wor", 1);
    const multi: HoidEvidenceAnswer = {
      status: "authorized",
      text: "Primera.\n\nSegunda.\n\nTercera.",
      claimIds: ["claim.one", "claim.two", "claim.three"],
      evidenceIds: [first.evidenceId, second.evidenceId, other.evidenceId],
      sources: [second, other, first],
      layout: "plain",
      segments: [
        { claimId: "claim.one", text: "Primera.", evidenceIds: [first.evidenceId] },
        { claimId: "claim.two", text: "Segunda.", evidenceIds: [second.evidenceId] },
        { claimId: "claim.three", text: "Tercera.", evidenceIds: [other.evidenceId] },
      ],
    };
    const result = buildHoidCrossBookEvidenceSummary(multi, progress(true, 4));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.summary.works[0].chapters).toEqual([1, 2]);
    expect(result.summary.works[0].evidenceIds).toEqual(["evidence.tfe.one", "evidence.tfe.two"]);
  });
  it("summarizes the exact canonical presentation without re-reading raw answer progress", () => {
    const presented = presentHoidEvidenceAnswer(answer(), progress());
    expect(presented.status).toBe("ready");
    if (presented.status !== "ready") return;
    expect(summarizeHoidPresentedCrossBookEvidence(presented)).toEqual(
      buildHoidCrossBookEvidenceSummary(answer(), progress()),
    );
  });
});

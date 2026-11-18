import { describe, expect, it } from "vitest";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import {
  compareHoidTopicsAcrossWorlds,
  compareProductionHoidTopicsAcrossWorlds,
} from "./topicComparison";

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

function progress(tfeChapter = 3, worChapter = 3) {
  return {
    schemaVersion: 2,
    revision: 8,
    positions: [
      { bookId: "tfe", cursor: cursor("tfe", tfeChapter) },
      { bookId: "wor", cursor: cursor("wor", worChapter) },
    ],
    updatedAt: UPDATED_AT,
  };
}

function answer(claimId: string, text: string, sourceBookId: string, evidenceId: string) {
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
  subjectId: string,
  worldId: string,
  worldLabel: string,
  claimId: string,
  text: string,
  evidenceId: string,
  id = "assignment." + subjectId,
) {
  return {
    schemaVersion: 1,
    id,
    subjectKind: "entity",
    subjectId,
    worldId,
    worldLabel,
    topicId: "investiture-system",
    dimensionId: "mechanism",
    claimId,
    claimTextSha256: sha256Hex(text),
    evidenceIds: [evidenceId],
    review: {
      status: "approved",
      reviewerId: "reviewer-1",
      reviewedAt: "2026-11-18T10:00:00.000Z",
    },
  };
}

function request(firstAnswer = answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha"),
                 secondAnswer = answer("claim.beta", "Dato sintético Beta.", "wor", "evidence.beta")) {
  return {
    topicId: "investiture-system",
    dimensionId: "mechanism",
    entries: [
      { subjectKind: "entity", subjectId: "entity.alpha", answer: firstAnswer },
      { subjectKind: "entity", subjectId: "entity.beta", answer: secondAnswer },
    ],
  };
}

function assignments() {
  return [
    assignment("entity.alpha", "world-alpha", "Mundo Alfa", "claim.alpha", "Dato sintético Alfa.", "evidence.alpha"),
    assignment("entity.beta", "world-beta", "Mundo Beta", "claim.beta", "Dato sintético Beta.", "evidence.beta"),
  ];
}

describe("Hoid cross-world topic comparison", () => {
  it("presents reviewed facts side by side without inferring similarity or equivalence", () => {
    const result = compareHoidTopicsAcrossWorlds(request(), progress(), assignments());
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.comparison.mode).toBe("side-by-side");
    expect(result.comparison.inference).toBe("none");
    expect(result.comparison.entries.map(entry => entry.worldLabel)).toEqual(["Mundo Alfa", "Mundo Beta"]);
    expect(result.comparison.entries[0].citations[0].sourceBookId).toBe("tfe");
  });

  it("returns not-cross-world when all approved entries belong to the same world", () => {
    const sameWorld = assignments().map(item => ({ ...item, worldId: "world-alpha", worldLabel: "Mundo Alfa" }));
    expect(compareHoidTopicsAcrossWorlds(request(), progress(), sameWorld)).toEqual({ status: "not-cross-world" });
  });

  it("withholds the complete comparison when one source has not reached its own unlock threshold", () => {
    expect(compareHoidTopicsAcrossWorlds(request(), progress(3, 1), assignments()))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("rejects a claim whose text digest differs from its reviewed topic assignment", () => {
    const changed = assignments().map(item =>
      item.subjectId === "entity.alpha" ? { ...item, claimTextSha256: sha256Hex("Texto distinto.") } : item
    );
    expect(compareHoidTopicsAcrossWorlds(request(), progress(), changed))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("does not disclose whether an individual subject has an assignment", () => {
    expect(compareHoidTopicsAcrossWorlds(request(), progress(), assignments().slice(0, 1)))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("rejects duplicate subjects and mixed subject kinds", () => {
    const duplicate = {
      topicId: "investiture-system",
      dimensionId: "mechanism",
      entries: [
        { subjectKind: "entity", subjectId: "entity.alpha", answer: answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha") },
        { subjectKind: "entity", subjectId: "entity.alpha", answer: answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha") },
      ],
    };
    expect(compareHoidTopicsAcrossWorlds(duplicate, progress(), assignments()).status).toBe("unavailable");
    const mixed = {
      ...request(),
      entries: [
        { subjectKind: "entity", subjectId: "entity.alpha", answer: answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha") },
        { subjectKind: "work", subjectId: "tfe", answer: answer("claim.beta", "Dato sintético Beta.", "wor", "evidence.beta") },
      ],
    };
    expect(compareHoidTopicsAcrossWorlds(mixed, progress(), assignments()).status).toBe("unavailable");
  });

  it("rejects unknown dimensions and groups larger than the fixed comparison budget", () => {
    expect(compareHoidTopicsAcrossWorlds({ ...request(), dimensionId: "unknown" }, progress(), assignments()).status)
      .toBe("unavailable");
    const tooMany = {
      topicId: "investiture-system",
      dimensionId: "mechanism",
      entries: Array.from({ length: 5 }, (_, index) => ({
        subjectKind: "entity",
        subjectId: "entity." + index,
        answer: answer("claim." + index, "Dato sintético.", "tfe", "evidence." + index),
      })),
    };
    expect(compareHoidTopicsAcrossWorlds(tooMany, progress(), assignments()).status).toBe("unavailable");
  });

  it("uses the empty production registry and abstains until reviewed assignments are added", () => {
    expect(compareProductionHoidTopicsAcrossWorlds(request(), progress()))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("rejects malformed assignment batches and provider-shaped extra request fields", () => {
    expect(compareHoidTopicsAcrossWorlds(request(), progress(), [{ arbitrary: true }]).status).toBe("unavailable");
    expect(compareHoidTopicsAcrossWorlds({ ...request(), providerText: "invented" }, progress(), assignments()).status)
      .toBe("unavailable");
  });
});

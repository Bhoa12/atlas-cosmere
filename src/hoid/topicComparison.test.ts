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
  subjectKind = "work",
) {
  return {
    schemaVersion: 1,
    id,
    subjectKind,
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

function request(
  firstAnswer = answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha"),
  secondAnswer = answer("claim.beta", "Dato sintético Beta.", "wor", "evidence.beta"),
  subjectKind = "work",
  firstSubjectId = "tfe",
  secondSubjectId = "wor",
) {
  return {
    topicId: "investiture-system",
    dimensionId: "mechanism",
    entries: [
      { subjectKind, subjectId: firstSubjectId, answer: firstAnswer },
      { subjectKind, subjectId: secondSubjectId, answer: secondAnswer },
    ],
  };
}

function approvedClaims() {
  return [
    { id: "claim.alpha", text: "Dato sintético Alfa.", evidenceIds: ["evidence.alpha"] },
    { id: "claim.beta", text: "Dato sintético Beta.", evidenceIds: ["evidence.beta"] },
  ];
}

function knowledgeEntry(
  id: string,
  sourceBookId: string,
  firstAppearanceChapter = 1,
) {
  return {
    id,
    provenance: "verified",
    summary: "Resumen editorial sintético de prueba.",
    evidenceSource: {
      bookId: sourceBookId,
      chapter: 1,
      locatorId: locator(sourceBookId, 1),
    },
    evidenceUnlock: { bookId: sourceBookId, chapter: 2 },
    firstSafeAppearance: { bookId: sourceBookId, chapter: firstAppearanceChapter },
  };
}

function approvedKnowledge(includeEntities = false) {
  const entries = [
    knowledgeEntry("evidence.alpha", "tfe"),
    knowledgeEntry("evidence.beta", "wor"),
  ];
  if (includeEntities) {
    entries.push(knowledgeEntry("entity.alpha", "tfe"));
    entries.push(knowledgeEntry("entity.beta", "wor", 4));
  }
  return entries;
}

function assignments(subjectKind = "work") {
  return [
    assignment("tfe", "world-alpha", "Mundo Alfa", "claim.alpha", "Dato sintético Alfa.", "evidence.alpha", "assignment.alpha", subjectKind),
    assignment("wor", "world-beta", "Mundo Beta", "claim.beta", "Dato sintético Beta.", "evidence.beta", "assignment.beta", subjectKind),
  ];
}

function compare(input = request(), reading = progress(), registry = assignments(), entities = false) {
  return compareHoidTopicsAcrossWorlds(
    input,
    reading,
    registry,
    approvedClaims(),
    approvedKnowledge(entities),
  );
}

describe("Hoid cross-world topic comparison", () => {
  it("presents reviewed facts side by side without inferring similarity or equivalence", () => {
    const result = compare();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.comparison.mode).toBe("side-by-side");
    expect(result.comparison.inference).toBe("none");
    expect(result.comparison.entries.map(entry => entry.worldLabel)).toEqual(["Mundo Alfa", "Mundo Beta"]);
    expect(result.comparison.entries[0].citations[0].sourceBookId).toBe("tfe");
  });

  it("returns not-cross-world when all approved entries belong to the same world", () => {
    const sameWorld = assignments().map(item => ({ ...item, worldId: "world-alpha", worldLabel: "Mundo Alfa" }));
    expect(compare(request(), progress(), sameWorld)).toEqual({ status: "not-cross-world" });
  });

  it("withholds the complete comparison when one source has not reached its own unlock threshold", () => {
    expect(compare(request(), progress(3, 1)))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("rejects a claim whose text digest differs from its reviewed topic assignment", () => {
    const changed = assignments().map(item =>
      item.subjectId === "tfe" ? { ...item, claimTextSha256: sha256Hex("Texto distinto.") } : item
    );
    expect(compare(request(), progress(), changed))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("rejects forged source locators even when the fabricated citation points to an unlocked chapter", () => {
    const forgedSecondAnswer = answer("claim.beta", "Dato sintético Beta.", "tfe", "evidence.beta");
    expect(compare(request(undefined, forgedSecondAnswer)))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("does not disclose whether an individual subject has an assignment", () => {
    expect(compare(request(), progress(), assignments().slice(0, 1)))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("requires an entity's own first-safe-appearance boundary in addition to claim evidence unlocks", () => {
    const entityAssignments = [
      assignment("entity.alpha", "world-alpha", "Mundo Alfa", "claim.alpha", "Dato sintético Alfa.", "evidence.alpha", "assignment.entity-alpha", "entity"),
      assignment("entity.beta", "world-beta", "Mundo Beta", "claim.beta", "Dato sintético Beta.", "evidence.beta", "assignment.entity-beta", "entity"),
    ];
    const entityRequest = request(
      answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha"),
      answer("claim.beta", "Dato sintético Beta.", "wor", "evidence.beta"),
      "entity",
      "entity.alpha",
      "entity.beta",
    );
    expect(compare(entityRequest, progress(3, 3), entityAssignments, true))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
    expect(compare(entityRequest, progress(3, 4), entityAssignments, true).status).toBe("ready");
  });

  it("rejects duplicate subjects, mixed subject kinds and provider-shaped extra fields", () => {
    const duplicate = request(
      answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha"),
      answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha"),
      "work",
      "tfe",
      "tfe",
    );
    expect(compare(duplicate).status).toBe("unavailable");
    const mixed = {
      ...request(),
      entries: [
        { subjectKind: "work", subjectId: "tfe", answer: answer("claim.alpha", "Dato sintético Alfa.", "tfe", "evidence.alpha") },
        { subjectKind: "entity", subjectId: "entity.beta", answer: answer("claim.beta", "Dato sintético Beta.", "wor", "evidence.beta") },
      ],
    };
    expect(compare(mixed).status).toBe("unavailable");
    expect(compare({ ...request(), providerText: "invented" }).status).toBe("unavailable");
  });

  it("rejects unknown dimensions and groups larger than the fixed comparison budget", () => {
    expect(compare({ ...request(), dimensionId: "unknown" }).status).toBe("unavailable");
    const tooMany = {
      topicId: "investiture-system",
      dimensionId: "mechanism",
      entries: Array.from({ length: 5 }, (_, index) => ({
        subjectKind: "work",
        subjectId: index === 0 ? "tfe" : "wor",
        answer: answer("claim." + index, "Dato sintético.", "tfe", "evidence." + index),
      })),
    };
    expect(compare(tooMany).status).toBe("unavailable");
  });

  it("uses the empty production registry and abstains until reviewed assignments are added", () => {
    expect(compareProductionHoidTopicsAcrossWorlds(request(), progress()))
      .toEqual({ status: "unavailable", reason: "no-authorized-comparison" });
  });

  it("rejects malformed assignment and verified-knowledge registries", () => {
    expect(compareHoidTopicsAcrossWorlds(request(), progress(), [{ arbitrary: true }], approvedClaims(), approvedKnowledge()).status)
      .toBe("unavailable");
    expect(compareHoidTopicsAcrossWorlds(request(), progress(), assignments(), approvedClaims(), [{ arbitrary: true }]).status)
      .toBe("unavailable");
  });
});

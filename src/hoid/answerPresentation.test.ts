import { describe, expect, it } from "vitest";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { presentHoidEvidenceAnswer } from "./answerPresentation";

const updatedAt = "2026-11-17T00:00:00.000Z";

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

function progressAt(openChapter: number) {
  return {
    schemaVersion: 2,
    revision: 1,
    positions: [{ bookId: "tfe", cursor: cursor("tfe", openChapter) }],
    updatedAt,
  };
}

function completedProgress() {
  return {
    schemaVersion: 2,
    revision: 1,
    positions: [{ bookId: "tfe", completed: true }],
    updatedAt,
  };
}

function source(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: "evidence-vin-ch1",
    sourceBookId: "tfe",
    sourceChapter: 1,
    locatorId: locator("tfe", 1),
    unlockBookId: "tfe",
    unlockChapter: 2,
    ...overrides,
  };
}

function authorizedAnswer(overrides: Record<string, unknown> = {}) {
  return {
    status: "authorized",
    text: "Afirmación editorial original y revisada.",
    claimIds: ["claim-vin"],
    evidenceIds: ["evidence-vin-ch1"],
    sources: [source()],
    ...overrides,
  };
}

describe("Hoid answer presentation", () => {
  it("shows exact authorized text and a work/chapter citation after the unlock boundary", () => {
    const result = presentHoidEvidenceAnswer(authorizedAnswer(), progressAt(3));
    expect(result).toMatchObject({
      status: "ready",
      text: "Afirmación editorial original y revisada.",
      citations: [{
        evidenceId: "evidence-vin-ch1",
        sourceBookId: "tfe",
        title: "El Imperio Final",
        chapter: 1,
      }],
    });
  });

  it("does not disclose an answer or citation while its unlock chapter is open", () => {
    const result = presentHoidEvidenceAnswer(authorizedAnswer(), progressAt(2));
    expect(result).toMatchObject({ status: "withheld", reason: "locked-evidence" });
    expect(result).not.toHaveProperty("citations");
    expect(result).not.toHaveProperty("text", "Afirmación editorial original y revisada.");
  });

  it("allows citation disclosure when the source work is explicitly completed", () => {
    expect(presentHoidEvidenceAnswer(authorizedAnswer(), completedProgress()).status).toBe("ready");
  });

  it("withholds blocked and abstained runtime text rather than echoing it", () => {
    const result = presentHoidEvidenceAnswer({
      status: "blocked",
      reason: "reading-position",
      text: "TEXTO INTERNO QUE NO DEBE MOSTRARSE",
      claimIds: [],
      evidenceIds: [],
      sources: [],
    }, progressAt(3));
    expect(result).toMatchObject({ status: "withheld", reason: "not-authorized" });
    expect(JSON.stringify(result)).not.toContain("TEXTO INTERNO");
  });

  it("rejects a citation whose unlock points to a different work", () => {
    const result = presentHoidEvidenceAnswer(
      authorizedAnswer({ sources: [source({ unlockBookId: "wor" })] }),
      progressAt(3),
    );
    expect(result).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects evidence IDs that do not exactly match source citations", () => {
    const result = presentHoidEvidenceAnswer(
      authorizedAnswer({ evidenceIds: ["different-evidence"] }),
      progressAt(3),
    );
    expect(result).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects duplicate claim and evidence identifiers", () => {
    expect(presentHoidEvidenceAnswer(
      authorizedAnswer({ claimIds: ["claim-vin", "claim-vin"] }),
      progressAt(3),
    )).toMatchObject({ status: "withheld", reason: "invalid-answer" });

    expect(presentHoidEvidenceAnswer(
      authorizedAnswer({ evidenceIds: ["evidence-vin-ch1", "evidence-vin-ch1"] }),
      progressAt(3),
    )).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects an unknown bibliography source", () => {
    const result = presentHoidEvidenceAnswer(
      authorizedAnswer({ sources: [source({ sourceBookId: "unknown-work", unlockBookId: "unknown-work" })] }),
      progressAt(3),
    );
    expect(result).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects malformed progress before disclosing any citation", () => {
    const result = presentHoidEvidenceAnswer(authorizedAnswer(), {
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "tfe", cursor: { chapterNumber: 999 } }],
      updatedAt,
    });
    expect(result).toMatchObject({ status: "withheld", reason: "invalid-progress" });
  });

  it("rejects unexpected fields on an authorized answer", () => {
    expect(presentHoidEvidenceAnswer(
      authorizedAnswer({ providerText: "untrusted" }),
      progressAt(3),
    )).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects source records with accessors", () => {
    const unsafeSource = source();
    Object.defineProperty(unsafeSource, "sourceChapter", {
      enumerable: true,
      get: () => 1,
    });
    expect(presentHoidEvidenceAnswer(
      authorizedAnswer({ sources: [unsafeSource] }),
      progressAt(3),
    )).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects a sparse citation array", () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(presentHoidEvidenceAnswer(
      authorizedAnswer({ sources: sparse }),
      progressAt(3),
    )).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("orders citations deterministically across source works", () => {
    const second = {
      evidenceId: "evidence-wor-ch2",
      sourceBookId: "wor",
      sourceChapter: 2,
      locatorId: locator("wor", 2),
      unlockBookId: "wor",
      unlockChapter: 2,
    };
    const progress = {
      schemaVersion: 2,
      revision: 2,
      positions: [
        { bookId: "tfe", cursor: cursor("tfe", 3) },
        { bookId: "wor", cursor: cursor("wor", 3) },
      ],
      updatedAt,
    };
    const result = presentHoidEvidenceAnswer(
      authorizedAnswer({
        evidenceIds: ["evidence-wor-ch2", "evidence-vin-ch1"],
        sources: [second, source()],
      }),
      progress,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.citations.map(item => item.sourceBookId)).toEqual(["tfe", "wor"]);
  });

  it("does not accept an arbitrary answer status", () => {
    expect(presentHoidEvidenceAnswer(
      authorizedAnswer({ status: "ready" }),
      progressAt(3),
    )).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });
});

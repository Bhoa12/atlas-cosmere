import { describe, expect, it } from "vitest";
import { getHoidEditorialRegistryStatus } from "./editorialRegistry";
import {
  createHoidEditorialClaimDraft,
  evaluateHoidEditorialClaimDrafts,
  getHoidEditorialClaimDraftStatus,
  HOID_EDITORIAL_CLAIM_DRAFTS,
  validateHoidEditorialClaimDraft,
  validateHoidEditorialClaimDraftBatch,
} from "./editorialClaimDrafts";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";

function evidence(bookId: string, chapter = 1, unlockChapter = chapter) {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  const digest = getVerifiedChapterDocumentSha256(
    bookId,
    result.manifest.editionId,
    result.manifest.navigationSha256,
    chapter,
  );
  if (!unit?.locatorId || !digest) throw new Error("Documento de prueba no verificado");
  return {
    source: { bookId, chapter, locatorId: unit.locatorId },
    unlock: { bookId, chapter: unlockChapter },
    sourceIntegrity: {
      editionId: result.manifest.editionId,
      navigationSha256: result.manifest.navigationSha256,
      documentSha256: digest,
    },
  };
}

function progress(positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>) {
  const cursorPositions = positions.map(position => {
    if (position.completed === true) {
      return { bookId: position.bookId, completed: true as const };
    }
    const created = createHoidReadingCursor(position.bookId, position.chapter);
    if (created.status !== "ready") throw new Error("Cursor de progreso no disponible");
    return { bookId: position.bookId, cursor: created.cursor };
  });
  return {
    schemaVersion: 2,
    revision: cursorPositions.length === 0 ? 0 : 1,
    positions: cursorPositions,
    updatedAt: cursorPositions.length === 0 ? null : "2026-11-17T08:00:00.000Z",
  };
}

function draft(id: string, items: ReturnType<typeof evidence>[]) {
  const result = createHoidEditorialClaimDraft({
    id,
    subjectId: "synthetic-subject",
    subjectKind: "concept",
    assertionKind: "interpretation",
    intent: "explain",
    statement: "Afirmación sintética de prueba para verificar la autorización por evidencias.",
    evidence: items,
  });
  if (result.status !== "valid") throw new Error("Borrador de afirmación no válido: " + result.reason);
  return result.draft;
}

describe("Hoid atomic editorial claim drafts", () => {
  it("creates a pending atomic claim from an individually verified source document", () => {
    const value = draft("synthetic.claim-one", [evidence("twok")]);
    expect(value.review.status).toBe("pending-review");
    expect(value.integrity.statementSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(value.integrity.claimSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateHoidEditorialClaimDraft(value).status).toBe("valid");
  });

  it("requires every source in a cross-work claim before review eligibility", () => {
    const value = draft("synthetic.cross-work", [
      evidence("twok"),
      evidence("edgedancer"),
    ]);
    const partial = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 2 },
    ]));
    expect(partial.status).toBe("ready");
    if (partial.status !== "ready") return;
    expect(partial.evaluations[0].status).toBe("withheld");
    if (partial.evaluations[0].status === "withheld") {
      expect(partial.evaluations[0].missingRequirements).toEqual([
        { bookId: "edgedancer", chapter: 1 },
      ]);
    }
  });

  it("marks a cross-work claim eligible only when all source thresholds are met", () => {
    const value = draft("synthetic.cross-work", [
      evidence("twok"),
      evidence("edgedancer"),
    ]);
    const result = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 2 },
      { bookId: "edgedancer", chapter: 2 },
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.evaluations).toEqual([{
      status: "eligible-for-review",
      claimId: "synthetic.cross-work",
      missingRequirements: [],
    }]);
  });

  it("does not expose claim text in eligibility results", () => {
    const value = draft("synthetic.no-text", [evidence("twok")]);
    const result = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 2 },
    ]));
    expect(JSON.stringify(result)).not.toContain(value.statement);
  });

  it("does not promote a staging claim into the production registry", () => {
    const value = draft("synthetic.no-promotion", [evidence("twok")]);
    evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 2 },
    ]));
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("uses the cursor boundary and does not unlock the currently open chapter", () => {
    const value = draft("synthetic.current-chapter", [evidence("twok")]);
    const result = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 1 },
    ]));
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.evaluations[0].status).toBe("withheld");
  });

  it("requires explicit completion or the complete unlock threshold", () => {
    const value = draft("synthetic.completion", [evidence("twok")]);
    const partial = evaluateHoidEditorialClaimDrafts([value], progress([]));
    const completed = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", completed: true },
    ]));
    expect(partial.status).toBe("ready");
    if (partial.status === "ready") expect(partial.evaluations[0].status).toBe("withheld");
    expect(completed.status).toBe("ready");
    if (completed.status === "ready") expect(completed.evaluations[0].status).toBe("eligible-for-review");
  });

  it("waits for a later per-source unlock threshold even when the source chapter is verified", () => {
    const value = draft("synthetic.later-unlock", [evidence("twok", 1, 2)]);
    const before = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 2 },
    ]));
    const reached = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 3 },
    ]));
    expect(before.status).toBe("ready");
    if (before.status === "ready") expect(before.evaluations[0].status).toBe("withheld");
    expect(reached.status).toBe("ready");
    if (reached.status === "ready") expect(reached.evaluations[0].status).toBe("eligible-for-review");
  });

  it("rejects an unlock threshold before its source chapter", () => {
    const item = evidence("twok");
    const invalid = {
      ...item,
      unlock: { bookId: "twok", chapter: 0 },
    };
    expect(createHoidEditorialClaimDraft({
      id: "synthetic.bad-unlock",
      subjectId: "synthetic-subject",
      subjectKind: "concept",
      assertionKind: "interpretation",
      intent: "explain",
      statement: "Afirmación sintética de prueba para un umbral inválido.",
      evidence: [invalid],
    }).status).toBe("invalid");
  });

  it("rejects a chapter whose document bytes have not been individually verified", () => {
    const secondUnit = getHoidReadingManifest("twok");
    if (secondUnit.status !== "ready") throw new Error("Manifest de prueba no disponible");
    const chapterTwoLocator = secondUnit.manifest.units.find(item => item.chapterNumber === 2)?.locatorId;
    if (!chapterTwoLocator) throw new Error("Localizador de capítulo dos no disponible");
    const item = evidence("twok", 1, 2);
    expect(createHoidEditorialClaimDraft({
      id: "synthetic.unverified-chapter",
      subjectId: "synthetic-subject",
      subjectKind: "concept",
      assertionKind: "interpretation",
      intent: "explain",
      statement: "Afirmación sintética que intenta citar un capítulo no inspeccionado.",
      evidence: [{
        ...item,
        source: { bookId: "twok", chapter: 2, locatorId: chapterTwoLocator },
      }],
    }).status).toBe("invalid");
  });

  it("rejects a forged source-document digest", () => {
    const item = evidence("twok");
    const forged = {
      ...item,
      sourceIntegrity: { ...item.sourceIntegrity, documentSha256: "a".repeat(64) },
    };
    expect(createHoidEditorialClaimDraft({
      id: "synthetic.forged-source",
      subjectId: "synthetic-subject",
      subjectKind: "concept",
      assertionKind: "interpretation",
      intent: "explain",
      statement: "Afirmación sintética con una huella documental inventada.",
      evidence: [forged],
    }).status).toBe("invalid");
  });

  it("rejects a statement modified after its integrity digest was created", () => {
    const value = draft("synthetic.tampered-statement", [evidence("twok")]);
    expect(validateHoidEditorialClaimDraft({
      ...value,
      statement: value.statement + " Alteración.",
    })).toEqual({ status: "invalid", reason: "invalid-integrity" });
  });

  it("rejects a claim digest modified independently of the statement", () => {
    const value = draft("synthetic.tampered-digest", [evidence("twok")]);
    expect(validateHoidEditorialClaimDraft({
      ...value,
      integrity: { ...value.integrity, claimSha256: "b".repeat(64) },
    })).toEqual({ status: "invalid", reason: "invalid-integrity" });
  });

  it("rejects duplicate source requirements instead of counting them twice", () => {
    const item = evidence("twok");
    expect(createHoidEditorialClaimDraft({
      id: "synthetic.duplicate-evidence",
      subjectId: "synthetic-subject",
      subjectKind: "concept",
      assertionKind: "interpretation",
      intent: "explain",
      statement: "Afirmación sintética con evidencia duplicada deliberadamente.",
      evidence: [item, item],
    }).status).toBe("invalid");
  });

  it("rejects a batch atomically when one claim is invalid", () => {
    const valid = draft("synthetic.valid", [evidence("twok")]);
    const invalid = { ...valid, id: "INVALID ID" };
    expect(validateHoidEditorialClaimDraftBatch([valid, invalid])).toEqual({
      status: "invalid",
      reason: "invalid-draft",
    });
    expect(evaluateHoidEditorialClaimDrafts([valid, invalid], progress([
      { bookId: "twok", chapter: 2 },
    ]))).toEqual({ status: "unavailable", reason: "invalid-claims" });
  });

  it("rejects duplicate claim identifiers in a batch", () => {
    const value = draft("synthetic.duplicate-id", [evidence("twok")]);
    expect(validateHoidEditorialClaimDraftBatch([value, value])).toEqual({
      status: "invalid",
      reason: "duplicate-id",
    });
  });

  it("sorts a valid batch deterministically by claim ID", () => {
    const first = draft("synthetic.zeta", [evidence("twok")]);
    const second = draft("synthetic.alpha", [evidence("edgedancer")]);
    const result = validateHoidEditorialClaimDraftBatch([first, second]);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.drafts.map(item => item.id)).toEqual(["synthetic.alpha", "synthetic.zeta"]);
  });

  it("rejects invalid or duplicated cursor snapshots as a whole", () => {
    const value = draft("synthetic.invalid-progress", [evidence("twok")]);
    expect(evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "twok", chapter: 2 },
      { bookId: "twok", chapter: 2 },
    ]))).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects accessors without executing them", () => {
    const value = draft("synthetic.accessor", [evidence("twok")]);
    let invoked = false;
    const hostile = { ...value } as Record<string, unknown>;
    Object.defineProperty(hostile, "statement", {
      enumerable: true,
      get: () => {
        invoked = true;
        return value.statement;
      },
    });
    expect(validateHoidEditorialClaimDraft(hostile).status).toBe("invalid");
    expect(invoked).toBe(false);
  });

  it("rejects extra fields and non-canonical evidence arrays", () => {
    const value = draft("synthetic.extra-field", [evidence("twok")]);
    expect(validateHoidEditorialClaimDraft({ ...value, sourcePassage: "forbidden" }).status).toBe("invalid");
    const sparse = new Array(1);
    expect(createHoidEditorialClaimDraft({
      id: "synthetic.sparse",
      subjectId: "synthetic-subject",
      subjectKind: "concept",
      assertionKind: "interpretation",
      intent: "explain",
      statement: "Afirmación sintética con un array de evidencias disperso.",
      evidence: sparse,
    }).status).toBe("invalid");
  });

  it("stages the first source-backed Cosmere atomic claim without promoting it", () => {
    expect(getHoidEditorialClaimDraftStatus()).toBe("pending-review");
    expect(HOID_EDITORIAL_CLAIM_DRAFTS).toHaveLength(1);
    const value = HOID_EDITORIAL_CLAIM_DRAFTS[0];
    expect(value.id).toBe("tfe.vin.ability.emotional-allomancy");
    expect(value.subjectId).toBe("tfe.vin");
    expect(value.evidence).toHaveLength(1);
    expect(value.evidence[0].source.bookId).toBe("tfe");
    expect(value.evidence[0].source.chapter).toBe(2);
    expect(value.evidence[0].source.locatorId).toBe("nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/002.xhtml");
    expect(value.evidence[0].unlock).toEqual({ bookId: "tfe", chapter: 3 });
    expect(value.review.status).toBe("pending-review");
    expect(validateHoidEditorialClaimDraftBatch(HOID_EDITORIAL_CLAIM_DRAFTS).status).toBe("valid");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("does not make the Cosmere claim eligible while chapter three is open", () => {
    const value = HOID_EDITORIAL_CLAIM_DRAFTS[0];
    const before = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "tfe", chapter: 3 },
    ]));
    const reached = evaluateHoidEditorialClaimDrafts([value], progress([
      { bookId: "tfe", chapter: 4 },
    ]));

    expect(before.status).toBe("ready");
    if (before.status === "ready") expect(before.evaluations[0].status).toBe("withheld");
    expect(reached.status).toBe("ready");
    if (reached.status === "ready") expect(reached.evaluations[0].status).toBe("eligible-for-review");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });
});

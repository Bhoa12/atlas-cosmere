import { describe, expect, it } from "vitest";
import { createHoidEvidenceAnswerFromRelationshipResult } from "./relationshipPresentation";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

const UPDATED_AT = "2026-11-18T06:00:00.000Z";

function snapshot(chapter = 3) {
  const cursor = createHoidReadingCursor("tfe", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor sintético no disponible");
  return {
    schemaVersion: 2,
    revision: 1,
    positions: [{ bookId: "tfe", cursor: cursor.cursor }],
    updatedAt: UPDATED_AT,
  };
}

function source(overrides: Record<string, unknown> = {}) {
  const manifest = getHoidReadingManifest("tfe");
  if (manifest.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = manifest.manifest.units[0];
  if (!unit.locatorId) throw new Error("Localizador sintético no disponible");
  const documentSha256 = getVerifiedChapterDocumentSha256(
    "tfe",
    manifest.manifest.editionId,
    manifest.manifest.navigationSha256,
    1,
  );
  if (!documentSha256) throw new Error("Hash documental sintético no disponible");
  return {
    evidenceId: "evidence.claim-one",
    sourceBookId: "tfe",
    sourceChapter: 1,
    locatorId: unit.locatorId,
    unlockBookId: "tfe",
    unlockChapter: 1,
    editionId: manifest.manifest.editionId,
    navigationSha256: manifest.manifest.navigationSha256,
    documentSha256,
    ...overrides,
  };
}

function explanation(overrides: Record<string, unknown> = {}) {
  const evidence = source();
  return {
    status: "ready",
    planId: "a".repeat(64),
    progressRevision: 1,
    text: "Afirmación editorial sintética.",
    segments: [{
      claimId: "claim.one",
      text: "Afirmación editorial sintética.",
      evidenceIds: [evidence.evidenceId],
      sources: [evidence],
    }],
    sources: [evidence],
    truncated: false,
    ...overrides,
  };
}

function relationshipResult(value: unknown, progress: unknown) {
  const projection = projectHoidCursorProgressSnapshot(progress);
  if (projection.status !== "ready") throw new Error("Progreso sintético inválido");
  return {
    status: "ready",
    explanation: value,
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
  };
}

describe("createHoidEvidenceAnswerFromRelationshipResult", () => {
  it("converts an exact, edition-verified graph explanation into the evidence answer contract", () => {
    const result = createHoidEvidenceAnswerFromRelationshipResult(relationshipResult(explanation(), snapshot()), snapshot());
    expect(result).toMatchObject({
      status: "authorized",
      text: "Afirmación editorial sintética.",
      claimIds: ["claim.one"],
      evidenceIds: ["evidence.claim-one"],
    });
  });

  it("rejects free prose not represented by exact editorial segments", () => {
    const result = createHoidEvidenceAnswerFromRelationshipResult(
      relationshipResult(explanation({ text: "Afirmación editorial sintética. Texto añadido." }), snapshot()),
      snapshot(),
    );
    expect(result).toBeNull();
  });

  it("rejects a document hash that does not match the inspected edition", () => {
    const invalid = source({ documentSha256: "f".repeat(64) });
    const value = explanation({
      sources: [invalid],
      segments: [{
        claimId: "claim.one",
        text: "Afirmación editorial sintética.",
        evidenceIds: [invalid.evidenceId],
        sources: [invalid],
      }],
    });
    expect(createHoidEvidenceAnswerFromRelationshipResult(relationshipResult(value, snapshot()), snapshot())).toBeNull();
  });

  it("rejects a source unlocked after the current chapter", () => {
    const locked = source({ unlockChapter: 4 });
    const value = explanation({
      sources: [locked],
      segments: [{
        claimId: "claim.one",
        text: "Afirmación editorial sintética.",
        evidenceIds: [locked.evidenceId],
        sources: [locked],
      }],
    });
    expect(createHoidEvidenceAnswerFromRelationshipResult(relationshipResult(value, snapshot(3)), snapshot(3))).toBeNull();
  });

  it("rejects truncated graph explanations rather than presenting an incomplete path", () => {
    expect(createHoidEvidenceAnswerFromRelationshipResult(
      relationshipResult(explanation({ truncated: true }), snapshot()),
      snapshot(),
    )).toBeNull();
  });

  it("rejects source IDs that differ between a segment and the top-level source manifest", () => {
    const value = explanation({
      segments: [{
        claimId: "claim.one",
        text: "Afirmación editorial sintética.",
        evidenceIds: ["evidence.other"],
        sources: [source()],
      }],
    });
    expect(createHoidEvidenceAnswerFromRelationshipResult(relationshipResult(value, snapshot()), snapshot())).toBeNull();
  });

  it("rejects duplicate claims and duplicate evidence IDs", () => {
    const evidence = source();
    const segment = {
      claimId: "claim.one",
      text: "Afirmación editorial sintética.",
      evidenceIds: [evidence.evidenceId],
      sources: [evidence],
    };
    expect(createHoidEvidenceAnswerFromRelationshipResult(
      relationshipResult(explanation({ segments: [segment, segment], text: segment.text + "\n\n" + segment.text }), snapshot()),
      snapshot(),
    )).toBeNull();
  });

  it("rejects an accessor-backed result without invoking the accessor", () => {
    const value = explanation() as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(value, "text", {
      enumerable: true,
      get() { invoked = true; return "No debe leerse"; },
    });
    expect(createHoidEvidenceAnswerFromRelationshipResult(relationshipResult(value, snapshot()), snapshot())).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects a result bound to a different progress revision or fingerprint", () => {
    const progress = snapshot();
    const valid = relationshipResult(explanation(), progress);
    expect(createHoidEvidenceAnswerFromRelationshipResult({ ...valid, progressRevision: 2 }, progress)).toBeNull();
    expect(createHoidEvidenceAnswerFromRelationshipResult({ ...valid, progressFingerprint: "f".repeat(64) }, progress)).toBeNull();
  });
});

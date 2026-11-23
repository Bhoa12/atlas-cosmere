import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
  type HoidApprovedClaimCore,
} from "./approvedClaimIntegrity";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { createHoidVerifiedAnswerPresenter } from "./verifiedAnswerPresentation";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { createHoidCursorAnswerProgressBinding } from "./cursorProgressFingerprint";

const updatedAt = "2026-11-20T00:00:00.000Z";
const reviewer = Object.freeze({ reviewerId: "test-reviewer", reviewedAt: "2026-11-20T00:00:00.000Z" });

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest unavailable");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Locator unavailable");
  return unit.locatorId;
}

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor unavailable");
  return result.cursor;
}

function progress(openChapter: number) {
  return { schemaVersion: 2, revision: 1, positions: [{ bookId: "tfe", cursor: cursor("tfe", openChapter) }], updatedAt };
}

function fixture() {
  const knowledge: HoidKnowledgeEntry[] = [{
    id: "evidence-alpha",
    aliases: ["Personaje Alfa"],
    kind: "character",
    firstSafeAppearance: { bookId: "tfe", chapter: 1 },
    evidenceSource: { bookId: "tfe", chapter: 1, locatorId: locator("tfe", 1) },
    evidenceUnlock: { bookId: "tfe", chapter: 2 },
    provenance: "verified",
    summary: "Resumen editorial original de prueba.",
  }];
  const core: HoidApprovedClaimCore = {
    id: "claim-alpha",
    text: "Afirmación editorial aprobada y verificable.",
    intent: "explain",
    evidenceIds: ["evidence-alpha"],
  };
  const attestation = createHoidApprovedClaimAttestation(core, knowledge, reviewer);
  if (attestation.status !== "valid") throw new Error("Could not attest test claim");
  const claim: HoidApprovedClaim = Object.freeze({ ...core, integrity: attestation.integrity, review: attestation.review });
  const citation = {
    evidenceId: "evidence-alpha",
    sourceBookId: "tfe",
    sourceChapter: 1,
    locatorId: locator("tfe", 1),
    unlockBookId: "tfe",
    unlockChapter: 2,
  };
  const answer = {
    status: "authorized",
    text: claim.text,
    claimIds: [claim.id],
    evidenceIds: ["evidence-alpha"],
    sources: [citation],
    segments: [{ claimId: claim.id, text: claim.text, evidenceIds: ["evidence-alpha"] }],
    layout: "plain",
  };
  return { knowledge, claim, answer, citation };
}

describe("Hoid verified answer presentation authority", () => {
  it("reconstructs a valid answer from the approved registry and unlocked source", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    expect(presenter).not.toBeNull();
    expect(presenter!.present(data.answer, progress(3))).toMatchObject({
      status: "ready",
      text: data.claim.text,
      claimIds: [data.claim.id],
      evidenceIds: ["evidence-alpha"],
      citations: [{ sourceBookId: "tfe", chapter: 1 }],
    });
  });

  it("rejects provider-authored text even when it reuses a valid claim and evidence ID", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    const result = presenter!.present({ ...data.answer, text: "Texto inventado por el proveedor." }, progress(3));
    expect(result).toMatchObject({ status: "withheld", reason: "invalid-answer" });
    expect(JSON.stringify(result)).not.toContain("Texto inventado");
  });

  it("rejects a fabricated claim ID absent from the approved registry", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    const forged = {
      ...data.answer,
      claimIds: ["claim-not-approved"],
      segments: [{ claimId: "claim-not-approved", text: data.claim.text, evidenceIds: ["evidence-alpha"] }],
    };
    expect(presenter!.present(forged, progress(3))).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects a citation whose work, chapter, locator or unlock differs from the registry", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    const forged = { ...data.answer, sources: [{ ...data.citation, sourceChapter: 2, locatorId: locator("tfe", 2) }] };
    expect(presenter!.present(forged, progress(3))).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("rejects a segment whose claim-to-evidence mapping was altered", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    const forged = {
      ...data.answer,
      segments: [{ claimId: data.claim.id, text: data.claim.text, evidenceIds: ["evidence-other"] }],
    };
    expect(presenter!.present(forged, progress(3))).toMatchObject({ status: "withheld", reason: "invalid-answer" });
  });

  it("withholds a claim while its required reader cursor is still open", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    const result = presenter!.present(data.answer, progress(2));
    expect(result).toMatchObject({ status: "withheld", reason: "locked-evidence" });
    expect(result).not.toHaveProperty("citations");
  });

  it("snapshots approved claim text and source citations at construction time", () => {
    const data = fixture();
    const mutableClaim = { ...data.claim } as HoidApprovedClaim;
    const mutableKnowledge = [{ ...data.knowledge[0] }] as HoidKnowledgeEntry[];
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: mutableKnowledge, claims: [mutableClaim] });
    expect(presenter).not.toBeNull();

    (mutableClaim as unknown as { text: string }).text = "Texto cambiado después de construir.";
    (mutableKnowledge[0] as unknown as { evidenceSource: unknown }).evidenceSource = {
      bookId: "tfe",
      chapter: 2,
      locatorId: locator("tfe", 2),
    };

    expect(presenter!.present(data.answer, progress(3))).toMatchObject({
      status: "ready",
      text: data.claim.text,
      citations: [{ sourceBookId: "tfe", chapter: 1 }],
    });
  });

  it("never echoes blocked or abstained runtime text", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    const result = presenter!.present({
      status: "blocked",
      reason: "reading-position",
      text: "INTERNAL LOCKED SPOILER",
      claimIds: [],
      evidenceIds: [],
      sources: [],
    }, progress(3));
    expect(result).toMatchObject({ status: "withheld", reason: "not-authorized" });
    expect(JSON.stringify(result)).not.toContain("INTERNAL LOCKED SPOILER");
  });

  it("rejects a registry containing a claim whose source document is not verified", () => {
    const data = fixture();
    const invalidKnowledge = [{
      ...data.knowledge[0],
      evidenceSource: { bookId: "tfe", chapter: 10, locatorId: locator("tfe", 10) },
      evidenceUnlock: { bookId: "tfe", chapter: 11 },
    }] as HoidKnowledgeEntry[];
    expect(createHoidVerifiedAnswerPresenter({ knowledge: invalidKnowledge, claims: [data.claim] })).toBeNull();
  });

  it("fails closed on an accessor-based configuration without evaluating the accessor", () => {
    const data = fixture();
    let invoked = false;
    const config = { knowledge: data.knowledge } as Record<string, unknown>;
    Object.defineProperty(config, "claims", {
      enumerable: true,
      get: () => { invoked = true; return [data.claim]; },
    });
    expect(createHoidVerifiedAnswerPresenter(config)).toBeNull();
    expect(invoked).toBe(false);
  });
  it("preserves the cursor freshness receipt through trusted claim reconstruction", () => {
    const data = fixture();
    const presenter = createHoidVerifiedAnswerPresenter({ knowledge: data.knowledge, claims: [data.claim] });
    if (!presenter) throw new Error("Presenter unavailable");
    const currentProgress = progress(3);
    const projection = projectHoidCursorProgressSnapshot(currentProgress);
    if (projection.status !== "ready") throw new Error("Projection unavailable");
    const boundAnswer = {
      ...data.answer,
      progressBinding: createHoidCursorAnswerProgressBinding(projection),
    };

    expect(presenter.present(boundAnswer, currentProgress)).toMatchObject({ status: "ready" });
    expect(presenter.present(boundAnswer, progress(4))).toMatchObject({
      status: "withheld",
      reason: "stale-progress",
    });
  });


});

import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  inspectHoidApprovedClaimEvidenceBinding,
  validateHoidApprovedClaimAttestation,
} from "./approvedClaimIntegrity";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { isHoidKnowledgeKind } from "./knowledgeKinds";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Synthetic manifest unavailable");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Synthetic locator unavailable");
  return unit.locatorId;
}

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-alpha",
    aliases: ["Entidad Alfa"],
    kind: "character",
    firstSafeAppearance: { bookId: "twok", chapter: 2 },
    evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
    evidenceUnlock: { bookId: "twok", chapter: 3 },
    provenance: "verified",
    summary: "Resumen editorial sintético Alfa.",
  },
  {
    id: "e-beta",
    aliases: ["Entidad Beta"],
    kind: "concept",
    firstSafeAppearance: { bookId: "edgedancer", chapter: 3 },
    evidenceSource: { bookId: "edgedancer", chapter: 3, locatorId: locator("edgedancer", 3) },
    evidenceUnlock: { bookId: "edgedancer", chapter: 4 },
    provenance: "verified",
    summary: "Resumen editorial sintético Beta.",
  },
];

const core = Object.freeze({
  id: "claim-alpha",
  text: "Afirmación editorial sintética con evidencia documental.",
  intent: "explain" as const,
  evidenceIds: Object.freeze(["e-alpha"]),
  entityIds: Object.freeze(["e-alpha"]),
});

const reviewer = Object.freeze({
  reviewerId: "editorial-reviewer",
  reviewedAt: "2026-11-19T07:00:00.000Z",
});

function createAttestation(
  claim: unknown = core,
  sourceKnowledge: readonly HoidKnowledgeEntry[] = knowledge,
) {
  const result = createHoidApprovedClaimAttestation(claim, sourceKnowledge, reviewer);
  if (result.status !== "valid") throw new Error("Synthetic attestation could not be created: " + result.reason);
  return Object.freeze({ ...claim as object, integrity: result.integrity, review: result.review });
}

describe("Hoid approved-claim integrity", () => {

  it("resolves the exact verified edition and XHTML digest for its synthetic source", () => {
    const manifestResult = getHoidReadingManifest("twok");
    expect(manifestResult.status).toBe("ready");
    if (manifestResult.status !== "ready") return;
    const unit = manifestResult.manifest.units.find(candidate => candidate.chapterNumber === 2);
    expect(unit?.locatorId).toBe(locator("twok", 2));
    expect(isHoidKnowledgeKind("character")).toBe(true);
    expect(getVerifiedChapterDocumentSha256(
      "twok",
      manifestResult.manifest.editionId,
      manifestResult.manifest.navigationSha256,
      2,
    )).toMatch(/^[a-f0-9]{64}$/);
    expect(inspectHoidApprovedClaimEvidenceBinding("e-alpha", knowledge)).toEqual({ status: "valid" });
  });


  it("binds the exact statement, canonical claim, evidence sources and review metadata", () => {
    const claim = createAttestation();
    const result = validateHoidApprovedClaimAttestation(claim, knowledge);

    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.claim.integrity.statementSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.claim.integrity.claimSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.claim.integrity.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.claim.integrity.reviewSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.claim.review.claimSha256).toBe(result.claim.integrity.claimSha256);
    expect(result.claim.review.evidenceSha256).toBe(result.claim.integrity.evidenceSha256);
    expect(JSON.stringify(result.claim.integrity)).not.toContain(core.text);
  });

  it("rejects a statement changed after editorial attestation", () => {
    const claim = createAttestation();
    const tampered = { ...claim, text: "Texto sustituido después de la revisión." };
    expect(validateHoidApprovedClaimAttestation(tampered, knowledge)).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("rejects evidence whose unlock threshold changes after review", () => {
    const claim = createAttestation();
    const changedKnowledge = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, evidenceUnlock: { bookId: "twok", chapter: 4 } }
      : entry);
    expect(validateHoidApprovedClaimAttestation(claim, changedKnowledge)).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("binds entity kind, aliases, provenance and original summary metadata", () => {
    const claim = createAttestation();
    const changedKnowledge = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, aliases: ["Alias sustituido"] }
      : entry);
    expect(validateHoidApprovedClaimAttestation(claim, changedKnowledge)).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("rejects a locator substituted within the same chapter", () => {
    const claim = createAttestation();
    const changedKnowledge = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, evidenceSource: { ...entry.evidenceSource!, locatorId: "nav:forged-locator" } }
      : entry);
    expect(validateHoidApprovedClaimAttestation(claim, changedKnowledge)).toEqual({
      status: "invalid",
      reason: "unverified-source",
    });
  });

  it("refuses to attest a chapter without an individually verified XHTML digest", () => {
    const unverifiedKnowledge: HoidKnowledgeEntry[] = [{
      id: "e-unverified",
      aliases: ["Entidad sin documento inspeccionado"],
      kind: "concept",
      firstSafeAppearance: { bookId: "wor", chapter: 3 },
      evidenceSource: { bookId: "wor", chapter: 3, locatorId: locator("wor", 3) },
      evidenceUnlock: { bookId: "wor", chapter: 4 },
      provenance: "verified",
      summary: "Resumen sintético sin documento XHTML incluido en la allowlist.",
    }];
    const result = createHoidApprovedClaimAttestation({
      id: "claim-unverified",
      text: "Afirmación sin documento verificado.",
      intent: "explain",
      evidenceIds: ["e-unverified"],
    }, unverifiedKnowledge, reviewer);

    expect(result).toEqual({ status: "invalid", reason: "unverified-source" });
  });

  it("binds reviewer identity and timestamp to the exact claim digest", () => {
    const claim = createAttestation();
    const tampered = {
      ...claim,
      review: { ...claim.review, reviewerId: "different-reviewer" },
    };
    expect(validateHoidApprovedClaimAttestation(tampered, knowledge)).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("rejects a review claim fingerprint that points at different content", () => {
    const claim = createAttestation();
    const tampered = {
      ...claim,
      review: { ...claim.review, claimSha256: "0".repeat(64) },
    };
    expect(validateHoidApprovedClaimAttestation(tampered, knowledge)).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("rejects accessor-backed claim fields without invoking the getter", () => {
    let invoked = false;
    const getterClaim = Object.defineProperty({ ...core }, "text", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("must not execute");
      },
    });
    expect(createHoidApprovedClaimAttestation(getterClaim, knowledge, reviewer)).toEqual({
      status: "invalid",
      reason: "invalid-claim",
    });
    expect(invoked).toBe(false);
  });

  it("accepts ordinary aliases and rejects control characters in alias text", () => {
    expect(inspectHoidApprovedClaimEvidenceBinding("e-alpha", knowledge)).toEqual({ status: "valid" });
    const changed = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, aliases: ["Entidad\u0000Alfa"] }
      : entry);
    expect(inspectHoidApprovedClaimEvidenceBinding("e-alpha", changed)).toEqual({
      status: "invalid",
      reason: "invalid-aliases",
    });
  });

  it("rejects alias arrays with non-index properties", () => {
    const aliases = ["Entidad Alfa"] as string[] & { extra?: string };
    Object.defineProperty(aliases, "extra", {
      value: "must not be ignored",
      enumerable: true,
    });
    const changed = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, aliases }
      : entry);
    expect(inspectHoidApprovedClaimEvidenceBinding("e-alpha", changed)).toEqual({
      status: "invalid",
      reason: "invalid-aliases",
    });
  });

  it("rejects accessor-backed alias indices without invoking the getter", () => {
    let invoked = false;
    const aliases = ["Entidad Alfa"];
    Object.defineProperty(aliases, "0", {
      enumerable: true,
      configurable: true,
      get() {
        invoked = true;
        return "Entidad Alfa";
      },
    });
    const changed = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, aliases }
      : entry);
    expect(inspectHoidApprovedClaimEvidenceBinding("e-alpha", changed)).toEqual({
      status: "invalid",
      reason: "invalid-aliases",
    });
    expect(invoked).toBe(false);
  });

  it("rejects unknown evidence IDs and non-canonical claim shapes", () => {
    const unknown = createHoidApprovedClaimAttestation({
      id: "claim-unknown",
      text: "Afirmación sintética.",
      intent: "explain",
      evidenceIds: ["missing-evidence"],
    }, knowledge, reviewer);
    expect(unknown).toEqual({ status: "invalid", reason: "unverified-source" });

    const claim = createAttestation();
    expect(validateHoidApprovedClaimAttestation({ ...claim, unexpected: true }, knowledge)).toEqual({
      status: "invalid",
      reason: "invalid-claim",
    });
  });
});

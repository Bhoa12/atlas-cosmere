import { describe, expect, it } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import { getHoidReadingManifest } from "./readingManifest";
import {
  createHoidExactApprovedClaimAttestation,
  validateHoidExactApprovedClaimAttestation,
  type HoidExactEvidenceRecord,
} from "./exactUnitClaimIntegrity";
import type { HoidExactUnitEvidencePolicy } from "./unitEvidenceAuthorizationV2";

function reference(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidChapterReference(bookId, {
    chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
  });
  if (result.status !== "ready") throw new Error("Synthetic exact reference unavailable");
  return result.reference;
}

const core = Object.freeze({
  id: "claim.exact-alpha",
  text: "Afirmación editorial sintética vinculada a unidades exactas.",
  intent: "explain" as const,
  evidenceIds: Object.freeze(["evidence.exact-alpha"]),
  entityIds: Object.freeze(["evidence.exact-alpha"]),
});

const evidence: readonly HoidExactEvidenceRecord[] = Object.freeze([Object.freeze({
  id: "evidence.exact-alpha",
  aliases: Object.freeze(["Entidad Alfa"]),
  kind: "character" as const,
  provenance: "verified" as const,
  summary: "Resumen editorial original y sintético para la prueba.",
})]);

const policy: HoidExactUnitEvidencePolicy = Object.freeze({
  schemaVersion: 2,
  evidenceId: "evidence.exact-alpha",
  source: reference("twok", 2),
  firstSafeAppearance: reference("twok", 2),
  unlock: reference("twok", 3),
});

const reviewer = Object.freeze({
  reviewerId: "editorial-reviewer",
  reviewedAt: "2026-11-24T17:00:00.000Z",
});

function attested(
  claim: unknown = core,
  evidenceInput: readonly HoidExactEvidenceRecord[] = evidence,
  policies: readonly HoidExactUnitEvidencePolicy[] = [policy],
) {
  const result = createHoidExactApprovedClaimAttestation(claim, evidenceInput, policies, reviewer);
  if (result.status !== "valid") throw new Error("Synthetic exact attestation failed: " + result.reason);
  return Object.freeze({
    ...(claim as object),
    integrity: result.integrity,
    review: result.review,
  });
}

describe("Hoid exact-unit approved-claim attestation v2", () => {
  it("binds claim, verified source digest and exact unit identities", () => {
    const claim = attested();
    const result = validateHoidExactApprovedClaimAttestation(claim, evidence, [policy]);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.claim.integrity.schemaVersion).toBe(2);
    expect(result.claim.integrity.claimSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.claim.integrity.evidenceSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.claim.integrity.reviewSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(result.claim.integrity)).not.toContain(core.text);
  });

  it("binds an exact duplicate-label unlock without collapsing its identity", () => {
    const duplicatePolicy: HoidExactUnitEvidencePolicy = Object.freeze({
      schemaVersion: 2,
      evidenceId: "evidence.exact-alpha",
      source: reference("twok", 2),
      firstSafeAppearance: reference("edgedancer", 3),
      unlock: reference("sawt", 12, "chapter:012:unit:012"),
    });
    const result = createHoidExactApprovedClaimAttestation(core, evidence, [duplicatePolicy], reviewer);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    const ordinary = createHoidExactApprovedClaimAttestation(core, evidence, [policy], reviewer);
    expect(ordinary.status).toBe("valid");
    if (ordinary.status !== "valid") return;
    expect(result.integrity.evidenceSha256).not.toBe(ordinary.integrity.evidenceSha256);
  });

  it("supports cross-work first appearance and unlock references", () => {
    const crossPolicy: HoidExactUnitEvidencePolicy = Object.freeze({
      schemaVersion: 2,
      evidenceId: "evidence.exact-alpha",
      source: reference("twok", 2),
      firstSafeAppearance: reference("edgedancer", 3),
      unlock: reference("warbreaker", 2),
    });
    expect(createHoidExactApprovedClaimAttestation(core, evidence, [crossPolicy], reviewer).status)
      .toBe("valid");
  });

  it("rejects a claim statement changed after review", () => {
    const claim = attested();
    expect(validateHoidExactApprovedClaimAttestation({
      ...claim,
      text: "Texto sustituido después de la revisión.",
    }, evidence, [policy])).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("rejects a changed exact unlock identity", () => {
    const claim = attested();
    const changed = {
      ...policy,
      unlock: reference("twok", 4),
    };
    expect(validateHoidExactApprovedClaimAttestation(claim, evidence, [changed])).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("rejects a changed original summary", () => {
    const claim = attested();
    const changedEvidence = [Object.freeze({
      ...evidence[0],
      summary: "Resumen cambiado después de la revisión.",
    })];
    expect(validateHoidExactApprovedClaimAttestation(claim, changedEvidence, [policy])).toEqual({
      status: "invalid",
      reason: "integrity-mismatch",
    });
  });

  it("rejects a source chapter without an inspected body digest", () => {
    const unknownManifest = getHoidReadingManifest("wor");
    if (unknownManifest.status !== "ready") throw new Error("Synthetic manifest unavailable");
    const unverifiedPolicy: HoidExactUnitEvidencePolicy = Object.freeze({
      schemaVersion: 2,
      evidenceId: "evidence.exact-alpha",
      source: reference("wor", 3),
      firstSafeAppearance: reference("wor", 3),
      unlock: reference("wor", 4),
    });
    expect(createHoidExactApprovedClaimAttestation(core, evidence, [unverifiedPolicy], reviewer))
      .toEqual({ status: "invalid", reason: "unverified-source" });
  });

  it("rejects an ambiguous source body until an exact-unit body digest is allowlisted", () => {
    const ambiguousPolicy: HoidExactUnitEvidencePolicy = Object.freeze({
      schemaVersion: 2,
      evidenceId: "evidence.exact-alpha",
      source: reference("sawt", 12, "chapter:012:unit:012"),
      firstSafeAppearance: reference("sawt", 12, "chapter:012:unit:012"),
      unlock: reference("sawt", 12, "chapter:012:unit:012"),
    });
    expect(createHoidExactApprovedClaimAttestation(core, evidence, [ambiguousPolicy], reviewer))
      .toEqual({ status: "invalid", reason: "unverified-source" });
  });

  it("rejects mismatched evidence and policy identities", () => {
    expect(createHoidExactApprovedClaimAttestation(
      core,
      evidence,
      [{ ...policy, evidenceId: "evidence.other" }],
      reviewer,
    )).toEqual({ status: "invalid", reason: "invalid-policy" });
  });

  it("rejects duplicate policy IDs", () => {
    const twoEvidence = [
      evidence[0],
      Object.freeze({ ...evidence[0], id: "evidence.second" }),
    ];
    const twoCore = {
      ...core,
      evidenceIds: ["evidence.exact-alpha", "evidence.second"],
    };
    expect(createHoidExactApprovedClaimAttestation(
      twoCore,
      twoEvidence,
      [policy, { ...policy, evidenceId: "evidence.second" }],
      reviewer,
    )).toMatchObject({ status: "valid" });
    expect(createHoidExactApprovedClaimAttestation(
      twoCore,
      twoEvidence,
      [policy, policy],
      reviewer,
    )).toEqual({ status: "invalid", reason: "invalid-policy" });
  });

  it("rejects accessor-backed evidence and reviewer fields without invoking getters", () => {
    let invoked = false;
    const hostile = Object.defineProperty({ ...evidence[0] }, "summary", {
      enumerable: true,
      get() { invoked = true; return "hostile"; },
    });
    expect(createHoidExactApprovedClaimAttestation(core, [hostile], [policy], reviewer))
      .toEqual({ status: "invalid", reason: "invalid-evidence" });
    expect(invoked).toBe(false);

    const hostileReviewer = Object.defineProperty({}, "reviewerId", {
      enumerable: true,
      get() { invoked = true; return "reviewer"; },
    });
    expect(createHoidExactApprovedClaimAttestation(core, evidence, [policy], hostileReviewer))
      .toEqual({ status: "invalid", reason: "invalid-review" });
    expect(invoked).toBe(false);
  });

  it("rejects malformed schema versions and extra claim properties", () => {
    const claim = attested();
    expect(validateHoidExactApprovedClaimAttestation({
      ...claim,
      integrity: { ...claim.integrity, schemaVersion: 1 },
    }, evidence, [policy])).toEqual({ status: "invalid", reason: "invalid-review" });
    expect(validateHoidExactApprovedClaimAttestation({
      ...claim,
      unreviewed: true,
    }, evidence, [policy])).toEqual({ status: "invalid", reason: "invalid-claim" });
  });
});

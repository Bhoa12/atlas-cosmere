import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
import { buildHoidEditorialReviewBundle } from "./editorialReviewBundle";
import { createHoidReadingCursor } from "./readingManifest";
import { buildHoidEditorialBundleReviewSigningMessageFromPlan } from "./editorialReviewBundleQuorum";
import { buildHoidEditorialReviewKit } from "./editorialReviewKit";
import { issueHoidEditorialBundleReviewAttestation } from "./editorialReviewAttestationIssuer";

const REVIEWED_AT = "2026-11-25T18:00:00.000Z";
const sourceInput = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS.filter(item => item.identity.status === "resolved"),
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS.filter(item =>
    item.subject.id !== "edgedancer.unnamed-girl" && item.object.id !== "edgedancer.unnamed-girl",
  ),
});
const knowledge = buildHoidEditorialKnowledgeBundle(sourceInput);
if (knowledge.status !== "ready-for-review") throw new Error("Knowledge fixture unavailable");
const review = buildHoidEditorialReviewBundle(knowledge.manifest, sourceInput);
if (review.status !== "ready-for-review") throw new Error("Review fixture unavailable");

function buildFixture() {
  const cursor = createHoidReadingCursor("twok", 5);
  if (cursor.status !== "ready") throw new Error("Progress fixture unavailable");
  const progressSnapshot = Object.freeze({
    schemaVersion: 2,
    revision: 17,
    positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: cursor.cursor })]),
    updatedAt: REVIEWED_AT,
  });
  const packets = review.packets;
  const receipts = Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: review.manifest.fingerprint,
    summaries: Object.freeze(packets.summaries.map(packet => ({
      schemaVersion: 1, packetId: packet.packetId, draftId: packet.draftId,
      summarySha256: packet.summarySha256, sourceDocumentSha256: packet.sourceDocumentSha256,
      decision: "approved", reviewerId: "summary-reviewer", reviewedAt: REVIEWED_AT,
      checklist: { factualAccuracy: true, completeness: true, originality: true, spoilerCeiling: true, provenance: true },
      noteCodes: ["no-issues"],
    }))),
    claims: Object.freeze(packets.claims.map(packet => ({
      schemaVersion: 1, packetId: packet.packetId, draftId: packet.draftId,
      claimSha256: packet.claimSha256, decision: "approved", reviewerId: "claim-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: { factualAccuracy: true, atomicity: true, subjectIdentity: true, completeness: true, originality: true, spoilerCeiling: true, provenance: true },
      noteCodes: ["no-issues"],
    }))),
    entities: Object.freeze(packets.entities.map(packet => ({
      schemaVersion: 1, packetId: packet.packetId, draftId: packet.draftId,
      identitySha256: packet.identitySha256, draftSha256: packet.draftSha256,
      decision: "approved", reviewerId: "entity-reviewer", reviewedAt: REVIEWED_AT,
      checklist: { factualAccuracy: true, identityResolution: true, uniqueness: true, completeness: true, spoilerCeiling: true, provenance: true },
      noteCodes: ["no-issues"],
    }))),
    relationships: Object.freeze(packets.relationships.map(packet => ({
      schemaVersion: 1, packetId: packet.packetId, draftId: packet.draftId,
      claimSha256: packet.claimSha256, decision: "approved", reviewerId: "relationship-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: { factualAccuracy: true, relationshipAccuracy: true, entityIdentity: true, completeness: true, originality: true, spoilerCeiling: true, provenance: true },
      noteCodes: ["no-issues"],
    }))),
  });
  const context = Object.freeze({
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 320,
    baseRef: "feat/hoid-ia-core-run319",
    baseSha: "698390e555f757130bfa77ff28d94e11fe0bae4c",
    headRef: "feat/hoid-ia-core-run320",
    headSha: "d".repeat(40),
    promotionManifestPath: "docs/hoid/EDITORIAL_PROMOTION_MANIFEST.json",
  });
  const built = buildHoidEditorialReviewKit({
    knowledgeManifest: knowledge.manifest, sourceInput, receipts, progressSnapshot, context,
  });
  if (built.status !== "ready") throw new Error("Review kit fixture unavailable");
  return built.kit;
}
const kit = buildFixture();

describe("Hoid editorial reviewer attestation issuer", () => {
  it("issues an explicitly unverified attestation through an injected signer port", async () => {
    let signedMessage = "";
    const signer = Object.freeze({
      async sign(message: string) { signedMessage = message; return "ab".repeat(64); },
    });
    const result = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "approve", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a", signer,
    });
    expect(result.status).toBe("issued-unverified");
    if (result.status !== "issued-unverified") return;
    expect(signedMessage).toBe(buildHoidEditorialBundleReviewSigningMessageFromPlan(
      kit.promotionPlan, kit.context, "reviewer-a", "approve", REVIEWED_AT, "reviewer-key-a",
    ));
    expect(result.attestation).toMatchObject({
      schemaVersion: 1,
      reviewBundleFingerprint: kit.promotionPlan.reviewBundleFingerprint,
      promotionPlanFingerprint: kit.promotionPlan.fingerprint,
      reviewerId: "reviewer-a", decision: "approve", keyId: "reviewer-key-a",
      signatureHex: "ab".repeat(64),
    });
    expect(result.signingMessageSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.promotionAllowed).toBe(false);
    expect(result.productionWritePerformed).toBe(false);
  });

  it("can issue a signed rejection without converting it into approval", async () => {
    const result = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "reject", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a",
      signer: { async sign() { return "cd".repeat(64); } },
    });
    expect(result.status).toBe("issued-unverified");
    if (result.status === "issued-unverified") expect(result.attestation.decision).toBe("reject");
  });

  it("rejects a malformed signer without invoking it", async () => {
    const result = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "approve", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a",
      signer: { sign: "not-a-function" },
    });
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-signer" });
  });

  it("rejects accessor-backed signer objects without executing getters", async () => {
    let getterCalled = false;
    const signer = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(signer, "sign", {
      enumerable: true,
      get() { getterCalled = true; return async () => "ab".repeat(64); },
    });
    const result = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "approve", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a", signer,
    });
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-signer" });
    expect(getterCalled).toBe(false);
  });

  it("rejects a signature that is not exactly 64 bytes", async () => {
    const result = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "approve", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a",
      signer: { async sign() { return "ab".repeat(63); } },
    });
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-signature" });
  });

  it("blocks when the injected signer fails", async () => {
    const result = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "approve", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a",
      signer: { async sign() { throw new Error("hardware key unavailable"); } },
    });
    expect(result).toMatchObject({ status: "blocked", reason: "signer-failed" });
  });

  it("binds the signature to the exact Pull Request head so a changed head produces a different message", async () => {
    const messages: string[] = [];
    const signer = {
      async sign(message: string) {
        messages.push(message);
        return "ab".repeat(64);
      },
    };
    const original = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "approve", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a", signer,
    });
    const changedHead = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: { ...kit.context, headSha: "e".repeat(40) },
      reviewerId: "reviewer-a", decision: "approve", reviewedAt: REVIEWED_AT,
      keyId: "reviewer-key-a", signer,
    });
    expect(original.status).toBe("issued-unverified");
    expect(changedHead.status).toBe("issued-unverified");
    expect(messages).toHaveLength(2);
    expect(messages[0]).not.toBe(messages[1]);
  });

  it("rejects extra input properties", async () => {
    const result = await issueHoidEditorialBundleReviewAttestation({
      plan: kit.promotionPlan, context: kit.context, reviewerId: "reviewer-a",
      decision: "approve", reviewedAt: REVIEWED_AT, keyId: "reviewer-key-a",
      signer: { async sign() { return "ab".repeat(64); } }, privateKey: "not-accepted",
    });
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-input" });
  });
});

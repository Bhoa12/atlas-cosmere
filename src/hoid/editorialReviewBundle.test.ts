import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
import {
  buildHoidEditorialReviewBundle,
  validateHoidEditorialReviewBundleManifest,
  validateHoidEditorialReviewBundleReceipts,
} from "./editorialReviewBundle";

const sourceInput = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS,
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS,
});
const knowledge = buildHoidEditorialKnowledgeBundle(sourceInput);
if (knowledge.status !== "ready-for-review") {
  throw new Error("Knowledge bundle fixture is not ready for review");
}
const built = buildHoidEditorialReviewBundle(knowledge.manifest, sourceInput);
if (built.status !== "ready-for-review") {
  throw new Error("Editorial review bundle fixture is not ready");
}
const { manifest, packets } = built;
const resolvedEntities = HOID_EDITORIAL_ENTITY_DRAFTS.filter(item => item.identity.status === "resolved");
const resolvedRelationships = HOID_EDITORIAL_RELATIONSHIP_DRAFTS.filter(item =>
  item.subject.id !== "edgedancer.unnamed-girl" && item.object.id !== "edgedancer.unnamed-girl",
);
const resolvedSourceInput = Object.freeze({
  ...sourceInput,
  entities: resolvedEntities,
  relationships: resolvedRelationships,
});
const resolvedKnowledge = buildHoidEditorialKnowledgeBundle(resolvedSourceInput);
if (resolvedKnowledge.status !== "ready-for-review") {
  throw new Error("Resolved-only knowledge fixture is not ready for review");
}
const resolvedBuilt = buildHoidEditorialReviewBundle(resolvedKnowledge.manifest, resolvedSourceInput);
if (resolvedBuilt.status !== "ready-for-review") {
  throw new Error("Resolved-only review fixture is not ready");
}

function approvedSummaryReceipt(packet: (typeof packets.summaries)[number]) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceDocumentSha256: packet.sourceDocumentSha256,
    decision: "approved",
    reviewerId: "summary-reviewer",
    reviewedAt: "2026-11-18T00:00:00.000Z",
    checklist: {
      factualAccuracy: true,
      completeness: true,
      originality: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["no-issues"],
  };
}

function approvedClaimReceipt(packet: (typeof packets.claims)[number]) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    claimSha256: packet.claimSha256,
    decision: "approved",
    reviewerId: "claim-reviewer",
    reviewedAt: "2026-11-18T00:00:00.000Z",
    checklist: {
      factualAccuracy: true,
      atomicity: true,
      subjectIdentity: true,
      completeness: true,
      originality: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["no-issues"],
  };
}

function approvedEntityReceipt(packet: (typeof packets.entities)[number]) {
  const unresolved = packet.identity.status === "unresolved";
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    identitySha256: packet.identitySha256,
    draftSha256: packet.draftSha256,
    decision: unresolved ? "revision-required" : "approved",
    reviewerId: "entity-reviewer",
    reviewedAt: "2026-11-18T00:00:00.000Z",
    checklist: {
      factualAccuracy: !unresolved,
      identityResolution: !unresolved,
      uniqueness: true,
      completeness: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: unresolved ? ["identity-issue"] : ["no-issues"],
  };
}

function approvedRelationshipReceipt(packet: (typeof packets.relationships)[number]) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    claimSha256: packet.claimSha256,
    decision: "approved",
    reviewerId: "relationship-reviewer",
    reviewedAt: "2026-11-18T00:00:00.000Z",
    checklist: {
      factualAccuracy: true,
      relationshipAccuracy: true,
      entityIdentity: true,
      completeness: true,
      originality: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["no-issues"],
  };
}

function completeReceiptBatch(reviewPackets = packets, reviewFingerprint = manifest.fingerprint) {
  return {
    schemaVersion: 1,
    reviewBundleFingerprint: reviewFingerprint,
    summaries: reviewPackets.summaries.map(approvedSummaryReceipt),
    claims: reviewPackets.claims.map(approvedClaimReceipt),
    entities: reviewPackets.entities.map(approvedEntityReceipt),
    relationships: reviewPackets.relationships.map(approvedRelationshipReceipt),
  };
}

describe("Hoid complete editorial review bundle", () => {
  it("builds one deterministic packet inventory covering all four staging categories", () => {
    const first = buildHoidEditorialReviewBundle(knowledge.manifest, sourceInput);
    const second = buildHoidEditorialReviewBundle(knowledge.manifest, sourceInput);
    expect(first.status).toBe("ready-for-review");
    expect(second.status).toBe("ready-for-review");
    if (first.status !== "ready-for-review" || second.status !== "ready-for-review") return;
    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifest.packets).toHaveLength(53);
    expect(first.manifest.counts).toEqual({
      summaries: 35,
      atomicClaims: 1,
      entities: 14,
      relationships: 3,
    });
    expect(first.manifest.knowledgeBundleFingerprint).toBe(knowledge.manifest.fingerprint);
    expect(first.promotionAllowed).toBe(false);
    expect(first.productionWritePerformed).toBe(false);
  });

  it("binds each summary reference to the exact prefixed packet identity", () => {
    const summary = manifest.packets.find(item => item.category === "summary");
    expect(summary?.packetId).toMatch(/^review:[a-f0-9]{64}$/);
    expect(summary?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps prose and source passages out of the review manifest", () => {
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("statement");
    expect(serialized).not.toContain("Shallan llega");
    expect(serialized).not.toContain("Kelsier reconoce");
    expect(serialized).not.toContain("sourcePassage");
    expect(serialized).not.toContain("epubBytes");
  });

  it("rebuilds the manifest against the exact knowledge and source inventories", () => {
    expect(validateHoidEditorialReviewBundleManifest(
      manifest,
      knowledge.manifest,
      sourceInput,
    )).toMatchObject({ status: "valid", packetCount: 53 });
    expect(validateHoidEditorialReviewBundleManifest(
      manifest,
      knowledge.manifest,
      { ...sourceInput, relationships: [] },
    )).toMatchObject({ status: "invalid" });
  });

  it("rejects a changed packet digest when the old review-bundle fingerprint is retained", () => {
    const tampered = {
      ...manifest,
      packets: manifest.packets.map((item, index) =>
        index === 0 ? { ...item, contentSha256: "a".repeat(64) } : item,
      ),
    };
    expect(validateHoidEditorialReviewBundleManifest(
      tampered,
      knowledge.manifest,
      sourceInput,
    )).toEqual({ status: "invalid", reason: "review-bundle-fingerprint-mismatch" });
  });

  it("reports an empty receipt set as incomplete without granting promotion", () => {
    const result = validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      {
        schemaVersion: 1,
        reviewBundleFingerprint: manifest.fingerprint,
        summaries: [],
        claims: [],
        entities: [],
        relationships: [],
      },
    );
    expect(result).toMatchObject({
      status: "incomplete",
      approvedCount: 0,
      missingCount: 53,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("accepts a complete receipt set for a fully resolved review subset but still forbids production writes", () => {
    const reviewManifest = resolvedBuilt.manifest;
    const result = validateHoidEditorialReviewBundleReceipts(
      reviewManifest,
      resolvedKnowledge.manifest,
      resolvedSourceInput,
      completeReceiptBatch(resolvedBuilt.packets, reviewManifest.fingerprint),
    );
    expect(result).toEqual({
      status: "complete",
      approvedCount: 51,
      revisionRequiredCount: 0,
      rejectedCount: 0,
      missingCount: 0,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("does not allow an unresolved identity dossier to receive an approval receipt", () => {
    const unresolved = packets.entities.find(item => item.identity.status === "unresolved");
    expect(unresolved).toBeDefined();
    if (!unresolved) return;
    expect(approvedEntityReceipt(unresolved).decision).toBe("revision-required");
    const result = validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      completeReceiptBatch(),
    );
    expect(result).toMatchObject({
      status: "needs-revision",
      approvedCount: 52,
      revisionRequiredCount: 1,
      missingCount: 0,
      promotionAllowed: false,
    });
  });

  it("requires revision when any category contains a valid non-approved receipt", () => {
    const batch = completeReceiptBatch();
    const first = packets.summaries[0];
    const receipts = [...batch.summaries];
    receipts[0] = {
      ...approvedSummaryReceipt(first),
      decision: "revision-required",
      reviewerId: "summary-reviewer",
      checklist: {
        factualAccuracy: false,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["factual-issue"],
    };
    const result = validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      { ...batch, summaries: receipts },
    );
    expect(result).toMatchObject({
      status: "needs-revision",
      approvedCount: 45,
      revisionRequiredCount: 2,
      rejectedCount: 0,
      missingCount: 0,
      promotionAllowed: false,
    });
  });

  it("reports a missing receipt separately from a rejected receipt", () => {
    const batch = completeReceiptBatch();
    const result = validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      { ...batch, relationships: batch.relationships.slice(1) },
    );
    expect(result).toMatchObject({
      status: "incomplete",
      approvedCount: 45,
      revisionRequiredCount: 1,
      missingCount: 1,
    });
  });

  it("rejects duplicate and unknown packet references", () => {
    const batch = completeReceiptBatch();
    const duplicate = [...batch.summaries, batch.summaries[0]];
    expect(validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      { ...batch, summaries: duplicate },
    )).toMatchObject({ status: "invalid" });

    const unknown = batch.summaries.map((item, index) =>
      index === 0 ? { ...item, packetId: "review:" + "f".repeat(64) } : item,
    );
    expect(validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      { ...batch, summaries: unknown },
    )).toMatchObject({ status: "invalid" });
  });

  it("rejects accessor-backed receipt identifiers without invoking getters", () => {
    const batch = completeReceiptBatch();
    let getterCalled = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "packetId", {
      enumerable: true,
      get() { getterCalled = true; return packets.summaries[0].packetId; },
    });
    expect(validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      { ...batch, summaries: [hostile, ...batch.summaries.slice(1)] },
    )).toMatchObject({ status: "invalid" });
    expect(getterCalled).toBe(false);
  });

  it("rejects a receipt batch bound to another review-bundle fingerprint", () => {
    const batch = completeReceiptBatch();
    expect(validateHoidEditorialReviewBundleReceipts(
      manifest,
      knowledge.manifest,
      sourceInput,
      { ...batch, reviewBundleFingerprint: "f".repeat(64) },
    )).toMatchObject({ status: "invalid", reason: "review-bundle-mismatch" });
  });
});

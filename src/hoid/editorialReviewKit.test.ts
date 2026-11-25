import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import { buildHoidEditorialKnowledgeBundle } from "./editorialKnowledgeBundle";
import { buildHoidEditorialReviewBundle } from "./editorialReviewBundle";
import { createHoidReadingCursor } from "./readingManifest";
import {
  buildHoidEditorialBundleReviewSigningMessage,
  buildHoidEditorialBundleReviewSigningMessageFromPlan,
} from "./editorialReviewBundleQuorum";
import {
  buildHoidEditorialReviewKit,
  parseHoidEditorialReviewKit,
  serializeHoidEditorialReviewKit,
  validateHoidEditorialReviewKit,
} from "./editorialReviewKit";

const REVIEWED_AT = "2026-11-25T18:00:00.000Z";
const REPOSITORY = "Bhoa12/atlas-cosmere";
const sourceInput = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS.filter(item => item.identity.status === "resolved"),
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS.filter(item =>
    item.subject.id !== "edgedancer.unnamed-girl" &&
    item.object.id !== "edgedancer.unnamed-girl",
  ),
});
const knowledgeResult = buildHoidEditorialKnowledgeBundle(sourceInput);
if (knowledgeResult.status !== "ready-for-review") throw new Error("Knowledge fixture unavailable");
const reviewResult = buildHoidEditorialReviewBundle(knowledgeResult.manifest, sourceInput);
if (reviewResult.status !== "ready-for-review") throw new Error("Review fixture unavailable");
const packets = reviewResult.packets;

function progressSnapshot(revision = 17) {
  const cursor = createHoidReadingCursor("twok", 5);
  if (cursor.status !== "ready") throw new Error("Progress fixture unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "twok", cursor: cursor.cursor }),
    ]),
    updatedAt: REVIEWED_AT,
  });
}

function approvedReceipts() {
  return Object.freeze({
    schemaVersion: 1,
    reviewBundleFingerprint: reviewResult.manifest.fingerprint,
    summaries: Object.freeze(packets.summaries.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      summarySha256: packet.summarySha256,
      sourceDocumentSha256: packet.sourceDocumentSha256,
      decision: "approved",
      reviewerId: "summary-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: {
        factualAccuracy: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["no-issues"],
    }))),
    claims: Object.freeze(packets.claims.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: "claim-reviewer",
      reviewedAt: REVIEWED_AT,
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
    }))),
    entities: Object.freeze(packets.entities.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      identitySha256: packet.identitySha256,
      draftSha256: packet.draftSha256,
      decision: "approved",
      reviewerId: "entity-reviewer",
      reviewedAt: REVIEWED_AT,
      checklist: {
        factualAccuracy: true,
        identityResolution: true,
        uniqueness: true,
        completeness: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["no-issues"],
    }))),
    relationships: Object.freeze(packets.relationships.map(packet => ({
      schemaVersion: 1,
      packetId: packet.packetId,
      draftId: packet.draftId,
      claimSha256: packet.claimSha256,
      decision: "approved",
      reviewerId: "relationship-reviewer",
      reviewedAt: REVIEWED_AT,
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
    }))),
  });
}

const receipts = approvedReceipts();
const context = Object.freeze({
  repositoryFullName: REPOSITORY,
  pullRequestNumber: 212,
  baseRef: "feat/hoid-ia-core-run318",
  baseSha: "6b604c724c3c5bfaeac7fdd7504e83f7e9898c31",
  headRef: "feat/hoid-ia-core-run319",
  headSha: "c".repeat(40),
  promotionManifestPath: "docs/hoid/EDITORIAL_PROMOTION_MANIFEST.json",
});
const buildInput = () => Object.freeze({
  knowledgeManifest: knowledgeResult.manifest,
  sourceInput,
  receipts,
  progressSnapshot: progressSnapshot(),
  context,
});
const built = buildHoidEditorialReviewKit(buildInput());
if (built.status !== "ready") throw new Error("Review kit fixture unavailable: " + built.status);

describe("Hoid portable editorial review kit", () => {
  it("builds a deterministic, catalogue-bound kit for all four editorial categories", () => {
    const first = buildHoidEditorialReviewKit(buildInput());
    const second = buildHoidEditorialReviewKit(buildInput());
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(first.kit.fingerprint).toBe(second.kit.fingerprint);
    expect(first.kit.packets).toEqual(reviewResult.packets);
    expect(first.kit.promotionPlan.packetCount).toBe(reviewResult.manifest.packets.length);
    expect(first.kit.promotionAllowed).toBe(false);
    expect(first.kit.productionWritePerformed).toBe(false);
    expect(first.kit.catalogueFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exports only revision/fingerprint progress disclosure and explicit per-packet spoiler ceilings", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    const json = JSON.stringify(built.kit);
    expect(built.kit.progressDisclosure).toBe("revision-and-fingerprint-only");
    expect(built.kit.sourcePassagesIncluded).toBe(false);
    expect(built.kit.privateEpubBytesIncluded).toBe(false);
    expect(json).not.toContain("progressSnapshot");
    expect(json).not.toContain('"positions"');
    expect(built.kit.spoilerScope.length).toBeGreaterThan(0);
    expect(built.kit.spoilerScope.every(item => item.unlock.chapter >= item.source.chapter)).toBe(true);
    expect(built.kit.spoilerScope.every(item => /^[a-f0-9]{64}$/.test(item.source.documentSha256))).toBe(true);
  });

  it("revalidates the complete packet inventory, receipts, plan and reviewer context", () => {
    expect(validateHoidEditorialReviewKit(built.kit)).toMatchObject({
      status: "valid",
      packetCount: reviewResult.manifest.packets.length,
    });
  });

  it("rejects changed summary content even if the outer kit fingerprint is retained", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    const firstSummary = built.kit.sourceInput.summaries[0] as Record<string, unknown>;
    const tampered = {
      ...built.kit,
      sourceInput: {
        ...built.kit.sourceInput,
        summaries: [
          { ...firstSummary, summary: String(firstSummary.summary) + " Altered." },
          ...built.kit.sourceInput.summaries.slice(1),
        ],
      },
    };
    expect(validateHoidEditorialReviewKit(tampered).status).toBe("invalid");
  });

  it("rejects a changed promotion progress fingerprint or plan revision", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    const tampered = {
      ...built.kit,
      promotionPlan: {
        ...built.kit.promotionPlan,
        progressRevision: built.kit.promotionPlan.progressRevision + 1,
      },
    };
    expect(validateHoidEditorialReviewKit(tampered)).toEqual({
      status: "invalid",
      reason: "promotion-plan-mismatch",
    });
  });

  it("rejects altered spoiler ceilings and a mismatched Pull Request head", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    const changedScope = {
      ...built.kit,
      spoilerScope: built.kit.spoilerScope.map((item, index) =>
        index === 0 ? { ...item, unlock: { ...item.unlock, chapter: item.unlock.chapter + 1 } } : item,
      ),
    };
    expect(validateHoidEditorialReviewKit(changedScope)).toEqual({
      status: "invalid",
      reason: "spoiler-scope-mismatch",
    });
    const changedHead = {
      ...built.kit,
      context: { ...built.kit.context, headSha: "d".repeat(40) },
    };
    expect(validateHoidEditorialReviewKit(changedHead)).toEqual({
      status: "invalid",
      reason: "context-mismatch",
    });
  });

  it("rejects a different catalogue identity", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect(validateHoidEditorialReviewKit({
      ...built.kit,
      catalogueFingerprint: "0".repeat(64),
    })).toEqual({ status: "invalid", reason: "catalogue-mismatch" });
  });

  it("round-trips through bounded JSON serialization and parsing", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    const serialized = serializeHoidEditorialReviewKit(built.kit);
    expect(serialized.status).toBe("ready");
    if (serialized.status !== "ready") return;
    const parsed = parseHoidEditorialReviewKit(serialized.json);
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") return;
    expect(parsed.kit.fingerprint).toBe(built.kit.fingerprint);
    expect(parsed.kit).toEqual(built.kit);
    expect(parseHoidEditorialReviewKit("{broken").status).toBe("invalid");
  });

  it("blocks signing-context changes and emits the same domain-separated message as live-plan validation", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    const fromKit = buildHoidEditorialBundleReviewSigningMessageFromPlan(
      built.kit.promotionPlan,
      built.kit.context,
      "reviewer-a",
      "approve",
      REVIEWED_AT,
      "reviewer-key-a",
    );
    const withProgress = buildHoidEditorialBundleReviewSigningMessage(
      built.kit.promotionPlan,
      built.kit.reviewManifest,
      built.kit.knowledgeManifest,
      built.kit.sourceInput,
      built.kit.receipts,
      progressSnapshot(),
      built.kit.context,
      "reviewer-a",
      "approve",
      REVIEWED_AT,
      "reviewer-key-a",
    );
    expect(fromKit).toBe(withProgress);
    expect(buildHoidEditorialBundleReviewSigningMessageFromPlan(
      built.kit.promotionPlan,
      { ...built.kit.context, headSha: "d".repeat(40) },
      "reviewer-a",
      "approve",
      REVIEWED_AT,
      "reviewer-key-a",
    )).toBeNull();
  });

  it("rejects accessor-backed requests without invoking getters", () => {
    let getterCalled = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "knowledgeManifest", {
      enumerable: true,
      get() { getterCalled = true; return knowledgeResult.manifest; },
    });
    Object.defineProperties(hostile, {
      sourceInput: { enumerable: true, value: sourceInput },
      receipts: { enumerable: true, value: receipts },
      progressSnapshot: { enumerable: true, value: progressSnapshot() },
      context: { enumerable: true, value: context },
    });
    expect(buildHoidEditorialReviewKit(hostile)).toMatchObject({ status: "invalid", reason: "invalid-input" });
    expect(getterCalled).toBe(false);
  });

  it("does not treat the exported kit as a promotion or production-write capability", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect(built.kit.promotionAllowed).toBe(false);
    expect(built.kit.productionWritePerformed).toBe(false);
    expect(validateHoidEditorialReviewKit(built.kit).status).toBe("valid");
  });
});

import { describe, expect, it } from "vitest";
import { createHoidReadingCursor } from "./readingManifest";
import { getHoidEditorialRegistryStatus } from "./editorialRegistry";
import {
  buildHoidEditorialEntityReviewPackets,
  buildHoidEditorialPromotionPlan,
  createHoidEditorialEntityDraft,
  evaluateHoidEditorialEntityDrafts,
  getHoidEditorialEntityDraftStatus,
  getHoidEditorialEntityDraftDiagnostics,
  HOID_EDITORIAL_ENTITY_DRAFTS,
  validateHoidEditorialEntityDraft,
  validateHoidEditorialEntityReviewReceipt,
} from "./editorialEntityDrafts";
import type { HoidEditorialEntityReviewPacket } from "./editorialEntityDrafts";
import {
  buildHoidEditorialRelationshipReviewPackets,
  HOID_EDITORIAL_RELATIONSHIP_DRAFTS,
} from "./editorialRelationshipDrafts";

function progress(chapters: Readonly<Record<string, number>>) {
  const positions = Object.entries(chapters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bookId, chapter]) => {
      const cursor = createHoidReadingCursor(bookId, chapter);
      if (cursor.status !== "ready") throw new Error("Cursor de prueba no disponible: " + bookId);
      return Object.freeze({ bookId, cursor: cursor.cursor });
    });
  return Object.freeze({
    schemaVersion: 2,
    revision: 17,
    positions: Object.freeze(positions),
    updatedAt: "2026-11-17T20:00:00.000Z",
  });
}

function approvedEntityReceipt(packet: HoidEditorialEntityReviewPacket) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    identitySha256: packet.identitySha256,
    draftSha256: packet.draftSha256,
    decision: "approved",
    reviewerId: "independent-reviewer",
    reviewedAt: "2026-11-17T20:30:00.000Z",
    checklist: {
      factualAccuracy: true,
      identityResolution: true,
      uniqueness: true,
      completeness: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["no-issues"],
  };
}

function approvedRelationshipReceipt(packet: {
  packetId: string;
  draftId: string;
  claimSha256: string;
}) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    claimSha256: packet.claimSha256,
    decision: "approved",
    reviewerId: "independent-reviewer",
    reviewedAt: "2026-11-17T20:30:00.000Z",
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

describe("Hoid editorial entity identity staging", () => {
  it("reports every source-backed entity input as valid before batch assembly", () => {
    expect(getHoidEditorialEntityDraftDiagnostics().filter(item => item.status === "invalid")).toEqual([]);
  });

  it("stages fourteen identity dossiers without populating production knowledge or aliases", () => {
    expect(getHoidEditorialEntityDraftStatus()).toBe("pending-review");
    expect(HOID_EDITORIAL_ENTITY_DRAFTS).toHaveLength(14);
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
    expect(HOID_EDITORIAL_ENTITY_DRAFTS.map(item => item.id)).toEqual([
      "dawnshard.dlrwan",
      "dawnshard.lopen",
      "dawnshard.nikli",
      "dawnshard.rysn",
      "dawnshard.talik",
      "edgedancer.hauka",
      "edgedancer.lift",
      "edgedancer.unnamed-girl",
      "edgedancer.wyndle",
      "tfe.kelsier",
      "tfe.vin",
      "twok.jasnah",
      "twok.kaladin",
      "twok.shallan",
    ]);
    expect(HOID_EDITORIAL_ENTITY_DRAFTS.every(item => item.review.status === "pending-review")).toBe(true);
    expect(HOID_EDITORIAL_ENTITY_DRAFTS.every(item => !("aliases" in item))).toBe(true);
  });

  it("accepts phenomenon as a distinct staged entity kind without promoting it", () => {
    const source = HOID_EDITORIAL_ENTITY_DRAFTS[0];
    const candidate = createHoidEditorialEntityDraft({
      id: "synthetic.phenomenon",
      kind: "phenomenon",
      identity: { status: "resolved", canonicalLabel: "Fenómeno sintético" },
      evidence: source.evidence,
    });
    expect(candidate.status).toBe("valid");
    if (candidate.status === "valid") expect(candidate.draft.kind).toBe("phenomenon");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("uses previously verified TFE chapter-one and chapter-two documents for Vin and Kelsier identities", () => {
    const vin = HOID_EDITORIAL_ENTITY_DRAFTS.find(item => item.id === "tfe.vin");
    const kelsier = HOID_EDITORIAL_ENTITY_DRAFTS.find(item => item.id === "tfe.kelsier");
    expect(vin?.identity).toEqual({ status: "resolved", canonicalLabel: "Vin" });
    expect(kelsier?.identity).toEqual({ status: "resolved", canonicalLabel: "Kelsier" });
    expect(vin?.evidence[0].source).toMatchObject({ bookId: "tfe", chapter: 1 });
    expect(vin?.evidence[0].unlock).toEqual({ bookId: "tfe", chapter: 2 });
    expect(kelsier?.evidence[0].source).toMatchObject({ bookId: "tfe", chapter: 2 });
    expect(kelsier?.evidence[0].unlock).toEqual({ bookId: "tfe", chapter: 3 });
    expect(vin && "aliases" in vin).toBe(false);
    expect(kelsier && "aliases" in kelsier).toBe(false);
    expect(vin?.review.status).toBe("pending-review");
    expect(kelsier?.review.status).toBe("pending-review");
  });

  it("keeps the unnamed Edgedancer participant explicitly unresolved", () => {
    const item = HOID_EDITORIAL_ENTITY_DRAFTS.find(candidate => candidate.id === "edgedancer.unnamed-girl");
    expect(item?.identity).toEqual({ status: "unresolved", issueCode: "identity-not-established" });
    const packets = buildHoidEditorialEntityReviewPackets(HOID_EDITORIAL_ENTITY_DRAFTS);
    expect(packets.status).toBe("ready");
    if (packets.status !== "ready") return;
    const packet = packets.packets.find(candidate => candidate.draftId === "edgedancer.unnamed-girl");
    expect(packet?.identity.status).toBe("unresolved");
  });

  it("binds each identity dossier to an inspected chapter and the next-chapter unlock threshold", () => {
    for (const draft of HOID_EDITORIAL_ENTITY_DRAFTS) {
      expect(validateHoidEditorialEntityDraft(draft).status).toBe("valid");
      expect(draft.evidence).toHaveLength(1);
      expect(draft.evidence[0].unlock).toEqual({
        bookId: draft.evidence[0].source.bookId,
        chapter: draft.evidence[0].source.chapter + 1,
      });
      expect(draft.evidence[0].sourceIntegrity.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("rejects identity-label tampering when the original digest is retained", () => {
    const draft = HOID_EDITORIAL_ENTITY_DRAFTS.find(item => item.id === "twok.shallan");
    if (!draft || draft.identity.status !== "resolved") throw new Error("Entidad de prueba ausente");
    expect(validateHoidEditorialEntityDraft({
      ...draft,
      identity: { status: "resolved", canonicalLabel: "Otra identidad" },
    })).toEqual({ status: "invalid", reason: "invalid-integrity" });
  });

  it("rejects accessors and malformed identity objects", () => {
    const draft = HOID_EDITORIAL_ENTITY_DRAFTS.find(item => item.id === "twok.shallan");
    if (!draft) throw new Error("Entidad de prueba ausente");
    const accessor = { ...draft } as Record<string, unknown>;
    Object.defineProperty(accessor, "id", { enumerable: true, get: () => draft.id });
    expect(validateHoidEditorialEntityDraft(accessor).status).toBe("invalid");
    expect(createHoidEditorialEntityDraft({
      id: "twok.bad-identity",
      kind: "character",
      identity: { status: "resolved", canonicalLabel: "  " },
      evidence: draft.evidence,
    }).status).toBe("invalid");
  });

  it("requires the completed-through cursor to reach each evidence unlock", () => {
    const chapterFourOpen = evaluateHoidEditorialEntityDrafts(
      HOID_EDITORIAL_ENTITY_DRAFTS,
      progress({ twok: 4, edgedancer: 4, dawnshard: 4 }),
    );
    expect(chapterFourOpen.status).toBe("ready");
    if (chapterFourOpen.status !== "ready") return;
    expect(chapterFourOpen.evaluations.every(item => item.status === "withheld")).toBe(true);

    const chapterFiveOpen = evaluateHoidEditorialEntityDrafts(
      HOID_EDITORIAL_ENTITY_DRAFTS,
      progress({ twok: 5, edgedancer: 5, dawnshard: 5 }),
    );
    expect(chapterFiveOpen.status).toBe("ready");
    if (chapterFiveOpen.status !== "ready") return;
    expect(chapterFiveOpen.evaluations.find(item => item.entityId === "twok.shallan")?.status).toBe("eligible-for-review");
    expect(chapterFiveOpen.evaluations.find(item => item.entityId === "twok.kaladin")).toMatchObject({
      status: "withheld",
      reason: "evidence-locked",
      missingRequirements: [{ bookId: "twok", chapter: 5 }],
    });
    expect(chapterFiveOpen.evaluations.find(item => item.entityId === "edgedancer.unnamed-girl")).toMatchObject({
      status: "withheld",
      reason: "identity-unresolved",
    });
  });

  it("creates deterministic review packets without promoting identity labels to aliases", () => {
    const first = buildHoidEditorialEntityReviewPackets(HOID_EDITORIAL_ENTITY_DRAFTS);
    const second = buildHoidEditorialEntityReviewPackets(HOID_EDITORIAL_ENTITY_DRAFTS);
    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    expect(first.packets).toHaveLength(14);
    expect(first.packets.every(packet => packet.status === "pending-review")).toBe(true);
    expect(first.packets.every(packet => !("aliases" in packet))).toBe(true);
  });

  it("accepts a complete independent review but never authorizes automatic promotion", () => {
    const packets = buildHoidEditorialEntityReviewPackets(HOID_EDITORIAL_ENTITY_DRAFTS);
    expect(packets.status).toBe("ready");
    if (packets.status !== "ready") return;
    const packet = packets.packets.find(item => item.draftId === "twok.shallan");
    if (!packet) throw new Error("Paquete de revisión ausente");
    expect(validateHoidEditorialEntityReviewReceipt(packet, approvedEntityReceipt(packet))).toMatchObject({
      status: "valid",
      outcome: "approved-awaiting-source-promotion",
      promotionAllowed: false,
    });
  });

  it("does not allow an unresolved identity to receive an approved review receipt", () => {
    const packets = buildHoidEditorialEntityReviewPackets(HOID_EDITORIAL_ENTITY_DRAFTS);
    expect(packets.status).toBe("ready");
    if (packets.status !== "ready") return;
    const packet = packets.packets.find(item => item.draftId === "edgedancer.unnamed-girl");
    if (!packet) throw new Error("Paquete de identidad no resuelta ausente");
    expect(validateHoidEditorialEntityReviewReceipt(packet, approvedEntityReceipt(packet))).toEqual({
      status: "invalid",
      reason: "incomplete-approval",
    });
  });

  it("blocks the real staging bundle while identity, review and relationship gates remain unresolved", () => {
    const plan = buildHoidEditorialPromotionPlan(
      HOID_EDITORIAL_ENTITY_DRAFTS,
      [],
      HOID_EDITORIAL_RELATIONSHIP_DRAFTS,
      [],
      progress({ twok: 6, edgedancer: 6, dawnshard: 6 }),
    );
    expect(plan.status).toBe("blocked");
    if (plan.status !== "blocked") return;
    expect(plan.reason).toBe("promotion-gates");
    expect(plan.blockers).toContainEqual({
      code: "unresolved-identity",
      recordId: "edgedancer.unnamed-girl",
    });
    expect(plan.blockers.some(item => item.code === "missing-entity-review")).toBe(true);
    expect(plan.blockers.some(item => item.code === "missing-relationship-review")).toBe(true);
    expect(plan.promotionAllowed).toBe(false);
    expect(plan.productionWritePerformed).toBe(false);
  });

  it("produces only a maintainer-commit plan after all synthetic gates pass", () => {
    const entityIds = new Set(["twok.shallan", "twok.jasnah", "dawnshard.lopen", "dawnshard.talik"]);
    const entityDrafts = HOID_EDITORIAL_ENTITY_DRAFTS.filter(item => entityIds.has(item.id));
    const relationshipIds = new Set([
      "twok.relationship.shallan-seeks-jasnah",
      "dawnshard.relationship.lopen-taliks-candid-exchange",
    ]);
    const relationshipDrafts = HOID_EDITORIAL_RELATIONSHIP_DRAFTS.filter(item => relationshipIds.has(item.id));
    const entityPackets = buildHoidEditorialEntityReviewPackets(entityDrafts);
    const relationshipPackets = buildHoidEditorialRelationshipReviewPackets(relationshipDrafts);
    expect(entityPackets.status).toBe("ready");
    expect(relationshipPackets.status).toBe("ready");
    if (entityPackets.status !== "ready" || relationshipPackets.status !== "ready") return;

    const plan = buildHoidEditorialPromotionPlan(
      entityDrafts,
      entityPackets.packets.map(approvedEntityReceipt),
      relationshipDrafts,
      relationshipPackets.packets.map(approvedRelationshipReceipt),
      progress({ twok: 5, dawnshard: 5 }),
    );
    expect(plan.status).toBe("ready-for-maintainer-commit");
    if (plan.status !== "ready-for-maintainer-commit") return;
    expect(plan.entityIds).toEqual([...entityIds].sort());
    expect(plan.relationshipIds).toEqual([...relationshipIds].sort());
    expect(plan.progressRevision).toBe(17);
    expect(plan.requiresProtectedReview).toBe(true);
    expect(plan.promotionAllowed).toBe(false);
    expect(plan.productionWritePerformed).toBe(false);
  });
});

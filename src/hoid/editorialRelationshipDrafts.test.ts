import { describe, expect, it } from "vitest";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { getHoidEditorialRegistryStatus } from "./editorialRegistry";
import {
  buildHoidEditorialRelationshipReviewPackets,
  createHoidEditorialRelationshipDraft,
  createHoidEditorialRelationshipDraftBatch,
  evaluateHoidEditorialRelationshipDrafts,
  getHoidEditorialRelationshipDraftStatus,
  getHoidEditorialRelationshipDraftDiagnostics,
  HOID_EDITORIAL_RELATIONSHIP_DRAFTS,
  validateHoidEditorialRelationshipDraft,
  validateHoidEditorialRelationshipDraftBatch,
  validateHoidEditorialRelationshipReviewReceipt,
} from "./editorialRelationshipDrafts";
import type { HoidEditorialClaimEvidence } from "./editorialClaimDrafts";

function evidence(bookId: string, chapter = 3, unlockChapter = chapter + 1): HoidEditorialClaimEvidence {
  const manifestResult = getHoidReadingManifest(bookId);
  if (manifestResult.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = manifestResult.manifest.units.find(item => item.chapterNumber === chapter);
  const documentSha256 = getVerifiedChapterDocumentSha256(
    bookId,
    manifestResult.manifest.editionId,
    manifestResult.manifest.navigationSha256,
    chapter,
  );
  if (!unit?.locatorId || !documentSha256) throw new Error("Documento de prueba no verificado");
  return {
    source: { bookId, chapter, locatorId: unit.locatorId },
    unlock: { bookId, chapter: unlockChapter },
    sourceIntegrity: {
      editionId: manifestResult.manifest.editionId,
      navigationSha256: manifestResult.manifest.navigationSha256,
      documentSha256,
    },
  };
}

function progress(bookId: string, chapter: number) {
  const cursor = createHoidReadingCursor(bookId, chapter);
  if (cursor.status !== "ready") throw new Error("Cursor de prueba no disponible");
  return {
    schemaVersion: 2,
    revision: 1,
    positions: [{ bookId, cursor: cursor.cursor }],
    updatedAt: "2026-11-17T08:00:00.000Z",
  };
}

const batch = buildHoidEditorialRelationshipReviewPackets(HOID_EDITORIAL_RELATIONSHIP_DRAFTS);
if (batch.status !== "ready") throw new Error("Relationship review packets are invalid");
const packet = batch.packets[0];

function approvedReceipt(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    claimSha256: packet.claimSha256,
    decision: "approved",
    reviewerId: "independent-relationship-reviewer",
    reviewedAt: "2026-11-17T20:00:00.000Z",
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
    ...overrides,
  };
}

describe("Hoid multi-entity relationship staging", () => {
  it("stages three binary relationship claims from individually inspected chapter-three documents", () => {
    expect(getHoidEditorialRelationshipDraftDiagnostics()).toEqual([
      { index: 0, id: "twok.relationship.shallan-seeks-jasnah", evidenceAvailable: true, status: "valid" },
      { index: 1, id: "edgedancer.relationship.hauka-intercepts-girl", evidenceAvailable: true, status: "valid" },
      { index: 2, id: "dawnshard.relationship.lopen-taliks-candid-exchange", evidenceAvailable: true, status: "valid" },
    ]);
    expect(getHoidEditorialRelationshipDraftStatus()).toBe("pending-review");
    expect(HOID_EDITORIAL_RELATIONSHIP_DRAFTS.map(item => item.id)).toEqual([
      "dawnshard.relationship.lopen-taliks-candid-exchange",
      "edgedancer.relationship.hauka-intercepts-girl",
      "twok.relationship.shallan-seeks-jasnah",
    ]);
    expect(HOID_EDITORIAL_RELATIONSHIP_DRAFTS).toHaveLength(3);
    expect(HOID_EDITORIAL_RELATIONSHIP_DRAFTS.every(item => item.review.status === "pending-review")).toBe(true);
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("requires two distinct participants and explicit evidence coverage for each", () => {
    for (const draft of HOID_EDITORIAL_RELATIONSHIP_DRAFTS) {
      expect(draft.subject.id).not.toBe(draft.object.id);
      expect(draft.subject.evidenceIndices.length).toBeGreaterThan(0);
      expect(draft.object.evidenceIndices.length).toBeGreaterThan(0);
      expect(draft.relationEvidenceIndices.length).toBeGreaterThan(0);
      expect(validateHoidEditorialRelationshipDraft(draft).status).toBe("valid");
    }
  });

  it("binds each relationship to the exact chapter-three source and chapter-four unlock threshold", () => {
    for (const draft of HOID_EDITORIAL_RELATIONSHIP_DRAFTS) {
      expect(draft.evidence).toHaveLength(1);
      expect(draft.evidence[0].source.chapter).toBe(3);
      expect(draft.evidence[0].unlock).toEqual({
        bookId: draft.evidence[0].source.bookId,
        chapter: 4,
      });
      expect(draft.evidence[0].sourceIntegrity.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("accepts a phenomenon participant through the canonical kind contract", () => {
    const result = createHoidEditorialRelationshipDraft({
      id: "synthetic.phenomenon-character-relationship",
      predicate: "related-to",
      subject: { id: "synthetic.phenomenon", kind: "phenomenon", evidenceIndices: [0] },
      object: { id: "synthetic.character", kind: "character", evidenceIndices: [0] },
      intent: "context",
      statement: "Relación sintética entre un fenómeno y un personaje, respaldada por evidencia verificada.",
      evidence: [evidence("twok")],
      relationEvidenceIndices: [0],
    });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.draft.subject.kind).toBe("phenomenon");
    expect(validateHoidEditorialRelationshipDraft(result.draft).status).toBe("valid");
  });

  it("withholds a relationship while chapter four is open and makes it eligible after chapter four is completed", () => {
    const draft = HOID_EDITORIAL_RELATIONSHIP_DRAFTS.find(item => item.id === "twok.relationship.shallan-seeks-jasnah")!;
    const before = evaluateHoidEditorialRelationshipDrafts([draft], progress("twok", 4));
    expect(before.status).toBe("ready");
    if (before.status !== "ready") return;
    expect(before.evaluations[0].status).toBe("withheld");

    const after = evaluateHoidEditorialRelationshipDrafts([draft], progress("twok", 5));
    expect(after.status).toBe("ready");
    if (after.status !== "ready") return;
    expect(after.evaluations[0].status).toBe("eligible-for-review");
  });

  it("requires every source when a relationship spans more than one work", () => {
    const result = createHoidEditorialRelationshipDraft({
      id: "synthetic.cross-work-relationship",
      predicate: "related-to",
      subject: { id: "synthetic.subject", kind: "character", evidenceIndices: [0] },
      object: { id: "synthetic.object", kind: "character", evidenceIndices: [1] },
      intent: "context",
      statement: "Relación sintética entre dos entidades respaldada por dos fuentes distintas.",
      evidence: [evidence("edgedancer"), evidence("twok")],
      relationEvidenceIndices: [0, 1],
    });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const partial = evaluateHoidEditorialRelationshipDrafts(
      [result.draft],
      progress("twok", 5),
    );
    expect(partial.status).toBe("ready");
    if (partial.status !== "ready") return;
    expect(partial.evaluations[0].status).toBe("withheld");
    if (partial.evaluations[0].status === "withheld") {
      expect(partial.evaluations[0].missingRequirements).toEqual([
        { bookId: "edgedancer", chapter: 4 },
      ]);
    }
  });

  it("rejects a relationship evidence set that does not support both participants", () => {
    const result = createHoidEditorialRelationshipDraft({
      id: "synthetic.uncovered-object",
      predicate: "related-to",
      subject: { id: "synthetic.subject", kind: "character", evidenceIndices: [0] },
      object: { id: "synthetic.object", kind: "character", evidenceIndices: [1] },
      intent: "context",
      statement: "Relación sintética cuya evidencia no cubre ambos extremos.",
      evidence: [evidence("edgedancer"), evidence("twok")],
      relationEvidenceIndices: [0],
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-relationship-scope" });
  });

  it("rejects self-relations, unknown predicates and malformed entity IDs", () => {
    const valid = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    expect(createHoidEditorialRelationshipDraft({
      id: valid.id,
      predicate: valid.predicate,
      subject: valid.subject,
      object: valid.subject,
      intent: valid.intent,
      statement: valid.statement,
      evidence: valid.evidence,
      relationEvidenceIndices: valid.relationEvidenceIndices,
    })).toEqual({ status: "invalid", reason: "invalid-identity" });

    expect(createHoidEditorialRelationshipDraft({
      id: "synthetic.unknown-predicate",
      predicate: "invented-relation",
      subject: valid.subject,
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: valid.evidence,
      relationEvidenceIndices: valid.relationEvidenceIndices,
    })).toEqual({ status: "invalid", reason: "invalid-predicate" });

    expect(createHoidEditorialRelationshipDraft({
      id: "synthetic.invalid-entity",
      predicate: valid.predicate,
      subject: { ...valid.subject, id: "not a valid id" },
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: valid.evidence,
      relationEvidenceIndices: valid.relationEvidenceIndices,
    })).toEqual({ status: "invalid", reason: "invalid-identity" });
  });

  it("rejects tampered statement and claim digests", () => {
    const valid = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    expect(validateHoidEditorialRelationshipDraft({
      ...valid,
      statement: valid.statement + " Texto añadido.",
    })).toEqual({ status: "invalid", reason: "invalid-integrity" });
    expect(validateHoidEditorialRelationshipDraft({
      ...valid,
      integrity: { ...valid.integrity, claimSha256: "a".repeat(64) },
    })).toEqual({ status: "invalid", reason: "invalid-integrity" });
  });

  it("rejects unverified chapter digests and locator substitutions", () => {
    const valid = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    const evidenceItem = valid.evidence[0];
    expect(createHoidEditorialRelationshipDraft({
      id: "synthetic.bad-digest",
      predicate: valid.predicate,
      subject: valid.subject,
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: [{
        ...evidenceItem,
        sourceIntegrity: { ...evidenceItem.sourceIntegrity, documentSha256: "a".repeat(64) },
      }],
      relationEvidenceIndices: valid.relationEvidenceIndices,
    }).status).toBe("invalid");
    expect(createHoidEditorialRelationshipDraft({
      id: "synthetic.bad-locator",
      predicate: valid.predicate,
      subject: valid.subject,
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: [{
        ...evidenceItem,
        source: { ...evidenceItem.source, locatorId: evidenceItem.source.locatorId + "-forged" },
      }],
      relationEvidenceIndices: valid.relationEvidenceIndices,
    }).status).toBe("invalid");
  });

  it("rejects getters without executing them", () => {
    const valid = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    let invoked = false;
    const subject = { ...valid.subject };
    Object.defineProperty(subject, "id", {
      enumerable: true,
      get: () => {
        invoked = true;
        return valid.subject.id;
      },
    });
    const result = createHoidEditorialRelationshipDraft({
      id: "synthetic.hostile-getter",
      predicate: valid.predicate,
      subject,
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: valid.evidence,
      relationEvidenceIndices: valid.relationEvidenceIndices,
    });
    expect(result).toEqual({ status: "invalid", reason: "invalid-identity" });
    expect(invoked).toBe(false);
  });

  it("rejects sparse evidence and index arrays", () => {
    const valid = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    const sparseEvidence = new Array(1);
    expect(createHoidEditorialRelationshipDraft({
      id: "synthetic.sparse-evidence",
      predicate: valid.predicate,
      subject: valid.subject,
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: sparseEvidence,
      relationEvidenceIndices: [0],
    }).status).toBe("invalid");

    const sparseIndices = new Array(1);
    expect(createHoidEditorialRelationshipDraft({
      id: "synthetic.sparse-indices",
      predicate: valid.predicate,
      subject: { ...valid.subject, evidenceIndices: sparseIndices },
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: valid.evidence,
      relationEvidenceIndices: valid.relationEvidenceIndices,
    }).status).toBe("invalid");
  });

  it("separates core-input creation from strict integrity-bearing batch validation", () => {
    const valid = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    const core = {
      id: valid.id,
      predicate: valid.predicate,
      subject: valid.subject,
      object: valid.object,
      intent: valid.intent,
      statement: valid.statement,
      evidence: valid.evidence,
      relationEvidenceIndices: valid.relationEvidenceIndices,
    };
    expect(validateHoidEditorialRelationshipDraftBatch([core])).toEqual({
      status: "invalid",
      reason: "invalid-draft",
    });
    const created = createHoidEditorialRelationshipDraftBatch([core]);
    expect(created.status).toBe("valid");
    if (created.status === "valid") {
      expect(created.drafts[0].integrity.claimSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("rejects duplicate relationship IDs as a batch", () => {
    const valid = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    expect(validateHoidEditorialRelationshipDraftBatch([valid, valid])).toEqual({
      status: "invalid",
      reason: "duplicate-id",
    });
  });

  it("builds deterministic review packets without source passages or EPUB bytes", () => {
    expect(batch.status).toBe("ready");
    if (batch.status !== "ready") return;
    expect(batch.packets).toHaveLength(3);
    expect(batch.packets.map(item => item.draftId)).toEqual([
      "dawnshard.relationship.lopen-taliks-candid-exchange",
      "edgedancer.relationship.hauka-intercepts-girl",
      "twok.relationship.shallan-seeks-jasnah",
    ]);
    expect(batch.packets.every(item => Object.values(item.checklist).every(value => !value))).toBe(true);
    expect("sourcePassage" in packet).toBe(false);
    expect("epubBytes" in packet).toBe(false);
  });

  it("accepts a complete approval only as awaiting source promotion", () => {
    const result = validateHoidEditorialRelationshipReviewReceipt(packet, approvedReceipt());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.outcome).toBe("approved-awaiting-source-promotion");
    expect(result.promotionAllowed).toBe(false);
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("rejects an approval when entity identity review is incomplete", () => {
    expect(validateHoidEditorialRelationshipReviewReceipt(packet, approvedReceipt({
      checklist: {
        factualAccuracy: true,
        relationshipAccuracy: true,
        entityIdentity: false,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
    }))).toEqual({ status: "invalid", reason: "incomplete-approval" });
  });

  it("supports revision-required and rejected receipts without free-form notes", () => {
    const result = validateHoidEditorialRelationshipReviewReceipt(packet, approvedReceipt({
      decision: "revision-required",
      checklist: {
        factualAccuracy: true,
        relationshipAccuracy: false,
        entityIdentity: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["relationship-issue"],
    }));
    expect(result.status).toBe("valid");
    if (result.status === "valid") expect(result.outcome).toBe("revision-required");

    expect(validateHoidEditorialRelationshipReviewReceipt(packet, approvedReceipt({
      notes: "No deben introducirse pasajes de la fuente en las notas.",
    }))).toEqual({ status: "invalid", reason: "invalid-receipt-shape" });
  });

  it("rejects a tampered review packet and a receipt bound to another claim", () => {
    expect(validateHoidEditorialRelationshipReviewReceipt({
      ...packet,
      statement: packet.statement + " Texto añadido.",
    }, approvedReceipt())).toEqual({ status: "invalid", reason: "invalid-packet" });

    expect(validateHoidEditorialRelationshipReviewReceipt(packet, approvedReceipt({
      claimSha256: "b".repeat(64),
    }))).toEqual({ status: "invalid", reason: "packet-mismatch" });
  });

  it("keeps all relationship drafts outside the production registry", () => {
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });
});

import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { getHoidEditorialRegistryStatus } from "./editorialRegistry";
import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
  type HoidEditorialReviewPacket,
} from "./editorialReviewPackets";

const built = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
if (built.status !== "ready") throw new Error("Test fixture review packets are invalid");
const packet = built.packets[0];

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceDocumentSha256: packet.sourceDocumentSha256,
    decision: "approved",
    reviewerId: "independent-reviewer",
    reviewedAt: "2026-11-17T08:00:00.000Z",
    checklist: {
      factualAccuracy: true,
      completeness: true,
      originality: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["no-issues"],
    ...overrides,
  };
}

// The staging packet inventory is derived from the verified chapter-body allowlist.
describe("Hoid editorial review packets", () => {
  it("builds a deterministic packet for each pending source-backed draft", () => {
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;
    expect(built.packets).toHaveLength(HOID_EDITORIAL_DRAFTS.length);
    expect(built.packets.map(item => item.draftId)).toEqual(
      HOID_EDITORIAL_DRAFTS.map(item => item.id).sort(),
    );
    expect(built.packets.every(item => item.status === "pending-review")).toBe(true);
  });

  it("contains original summaries and metadata, never an EPUB passage field", () => {
    expect(packet.summary.length).toBeGreaterThan(80);
    expect(packet.sourceDocumentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect("sourcePassage" in packet).toBe(false);
    expect("epubBytes" in packet).toBe(false);
  });

  it("rejects a packet whose chapter locator is changed without rebuilding its identity", () => {
    const tampered = {
      ...packet,
      source: { ...packet.source, locatorId: packet.source.locatorId + "-forged" },
    };
    expect(validateHoidEditorialReviewReceipt(tampered, receipt())).toEqual({
      status: "invalid",
      reason: "invalid-receipt-shape",
    });
  });

  it("rejects a packet whose unlock chapter is not a verified manifest unit", () => {
    const tampered = {
      ...packet,
      unlock: { ...packet.unlock, chapter: 76 },
    };
    expect(validateHoidEditorialReviewReceipt(tampered, receipt())).toEqual({
      status: "invalid",
      reason: "invalid-receipt-shape",
    });
  });

  it("starts every checklist item unchecked", () => {
    expect(Object.values(packet.checklist).every(value => value === false)).toBe(true);
  });

  it("binds a receipt to the exact draft and both integrity digests", () => {
    expect(validateHoidEditorialReviewReceipt(packet, receipt()).status).toBe("valid");
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      summarySha256: "a".repeat(64),
    }))).toEqual({ status: "invalid", reason: "packet-mismatch" });
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      sourceDocumentSha256: "b".repeat(64),
    }))).toEqual({ status: "invalid", reason: "packet-mismatch" });
  });

  it("requires every review criterion before an approved decision", () => {
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      checklist: {
        factualAccuracy: true,
        completeness: true,
        originality: true,
        spoilerCeiling: false,
        provenance: true,
      },
    }))).toEqual({ status: "invalid", reason: "incomplete-approval" });
  });

  it("returns an approved receipt as awaiting source promotion, never production-ready", () => {
    const result = validateHoidEditorialReviewReceipt(packet, receipt());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.outcome).toBe("approved-awaiting-source-promotion");
    expect(result.promotionAllowed).toBe(false);
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("supports revision and rejection without changing production knowledge", () => {
    const revision = validateHoidEditorialReviewReceipt(packet, receipt({
      decision: "revision-required",
      checklist: {
        factualAccuracy: true,
        completeness: false,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["completeness-issue"],
    }));
    const rejected = validateHoidEditorialReviewReceipt(packet, receipt({ decision: "rejected", noteCodes: ["factual-issue"] }));
    expect(revision.status === "valid" && revision.outcome).toBe("revision-required");
    expect(rejected.status === "valid" && rejected.outcome).toBe("rejected");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("rejects note-code arrays with custom prototypes", () => {
    const codes = ["no-issues"];
    Object.setPrototypeOf(codes, { custom: true });
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      checklist: {
        factualAccuracy: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: codes,
    }))).toEqual({ status: "invalid", reason: "invalid-checklist" });
  });

  it("rejects free-form reviewer notes so source passages cannot enter receipts", () => {
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      notes: "No copiar texto de la fuente",
    }))).toEqual({ status: "invalid", reason: "invalid-receipt-shape" });
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      noteCodes: ["unrecognized-source-quote"],
    }))).toEqual({ status: "invalid", reason: "invalid-checklist" });
  });

  it("rejects non-canonical timestamps and reviewer identities", () => {
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      reviewedAt: "2026-11-17",
    }))).toEqual({ status: "invalid", reason: "invalid-date" });
    expect(validateHoidEditorialReviewReceipt(packet, receipt({
      reviewerId: "not a valid reviewer id",
    }))).toEqual({ status: "invalid", reason: "invalid-reviewer" });
  });

  it("rejects accessors without executing them", () => {
    let invoked = false;
    const hostile = receipt();
    Object.defineProperty(hostile, "reviewerId", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "reviewer";
      },
    });
    expect(validateHoidEditorialReviewReceipt(packet, hostile)).toEqual({
      status: "invalid",
      reason: "invalid-receipt-shape",
    });
    expect(invoked).toBe(false);
  });

  it("does not mutate the pending packet or promote any draft", () => {
    const before = packet as HoidEditorialReviewPacket;
    validateHoidEditorialReviewReceipt(before, receipt());
    expect(before.status).toBe("pending-review");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });
});

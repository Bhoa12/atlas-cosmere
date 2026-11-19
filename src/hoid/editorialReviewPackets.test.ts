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
    expect(built.packets).toHaveLength(35);
    expect(built.packets.map(item => item.draftId)).toEqual([
      "dawnshard.chapter-001.akinah-expedition",
      "dawnshard.chapter-002.rysn-navani-akinah-mission",
      "dawnshard.chapter-003.lopen-talik-delegation",
      "dawnshard.chapter-004.rysn-crew-trust",
      "dawnshard.chapter-005.rysn-lopen-fabrial-demonstration",
      "dawnshard.chapter-006.rysn-worm-grain-trade",
      "dawnshard.chapter-007.lopen-crew-unease",
      "dawnshard.chapter-008.rysn-dead-santhid",
      "dawnshard.chapter-009.rysn-aluminum-fabrial",
      "dawnshard.chapter-010.rysn-arrests-nikli",
      "dawnshard.chapter-011.lopen-crosses-akinah-storm",
      "edgedancer.chapter-001.lift-departure",
      "edgedancer.chapter-002.lift-yeddaw-arrival",
      "edgedancer.chapter-003.hauka-grain-cart",
      "edgedancer.chapter-004.lift-immigrant-district",
      "edgedancer.chapter-005.lift-remembering-forgotten",
      "edgedancer.chapter-006.lift-tashikk-orphanage",
      "edgedancer.chapter-007.lift-tracks-darkness",
      "edgedancer.chapter-008.lift-follows-darkness",
      "edgedancer.chapter-009.lift-nale-szeth",
      "edgedancer.chapter-010.lift-orphanage-reflection",
      "edgedancer.chapter-011.lift-finds-great-indicium",
      "tfe.chapter-001.vin",
      "tfe.chapter-002.kelsier",
      "tfe.chapter-003.vin-kelsier",
      "twok.chapter-001.cenn-battle",
      "twok.chapter-002.kaladin-slave-caravan",
      "twok.chapter-003.shallan-kharbranth",
      "twok.chapter-004.kaladin-highstorm-camp",
      "twok.chapter-005.shallan-jasnah-assessment",
      "twok.chapter-006.kaladin-bridge-four",
      "twok.chapter-007.shallan-palanaeum-wait",
      "twok.chapter-008.shallan-jasnah-pupil",
      "twok.chapter-009.kaladin-recruit-death",
      "twok.chapter-010.kaladin-lirin-surgeon",
    ]);
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

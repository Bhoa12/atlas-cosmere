import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import {
  buildHoidEditorialClaimReviewPackets,
  validateHoidEditorialClaimReviewReceipt,
  type HoidEditorialClaimReviewPacket,
} from "./editorialClaimReviewPackets";

const built = buildHoidEditorialClaimReviewPackets(HOID_EDITORIAL_CLAIM_DRAFTS);
if (built.status !== "ready") throw new Error("Atomic claim review packet fixture is invalid");
const packet = built.packets[0];

function approvedReceipt(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    claimSha256: packet.claimSha256,
    decision: "approved",
    reviewerId: "independent-claim-reviewer",
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
    ...overrides,
  };
}

describe("Hoid atomic editorial claim review packets", () => {
  it("builds one deterministic packet for each validated atomic claim", () => {
    const first = buildHoidEditorialClaimReviewPackets(HOID_EDITORIAL_CLAIM_DRAFTS);
    const second = buildHoidEditorialClaimReviewPackets(HOID_EDITORIAL_CLAIM_DRAFTS);
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(first.packets).toEqual(second.packets);
    expect(first.packets).toHaveLength(1);
    expect(first.packets[0].status).toBe("pending-review");
    expect(first.packets[0].checklist).toEqual({
      factualAccuracy: false,
      atomicity: false,
      subjectIdentity: false,
      completeness: false,
      originality: false,
      spoilerCeiling: false,
      provenance: false,
    });
  });

  it("binds the packet to the exact claim and statement digests", () => {
    expect(packet.packetId).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.claimSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.statementSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.subjectId).toBe("tfe.vin");
    expect(packet.subjectKind).toBe("character");
  });

  it("includes original claim prose and source metadata but no copied source passage", () => {
    expect(packet.statement.length).toBeGreaterThan(20);
    expect(packet.evidence).toHaveLength(1);
    expect("sourcePassage" in packet).toBe(false);
    expect("epubBytes" in packet).toBe(false);
  });

  it("accepts a complete approval but never authorizes promotion", () => {
    expect(validateHoidEditorialClaimReviewReceipt(packet, approvedReceipt())).toMatchObject({
      status: "valid",
      outcome: "approved-awaiting-source-promotion",
      promotionAllowed: false,
    });
  });

  it("rejects an approval with any unchecked criterion", () => {
    expect(validateHoidEditorialClaimReviewReceipt(packet, approvedReceipt({
      checklist: {
        factualAccuracy: true,
        atomicity: false,
        subjectIdentity: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
    }))).toEqual({ status: "invalid", reason: "incomplete-approval" });
  });

  it("rejects a receipt bound to another claim digest", () => {
    expect(validateHoidEditorialClaimReviewReceipt(packet, approvedReceipt({
      claimSha256: "f".repeat(64),
    }))).toEqual({ status: "invalid", reason: "packet-mismatch" });
  });

  it("rejects a packet whose claim digest is changed without rebuilding its packet identity", () => {
    const tampered = { ...packet, claimSha256: "f".repeat(64) };
    expect(validateHoidEditorialClaimReviewReceipt(tampered, approvedReceipt())).toEqual({
      status: "invalid",
      reason: "invalid-packet",
    });
  });

  it("accepts a valid revision-required receipt without treating it as approval", () => {
    expect(validateHoidEditorialClaimReviewReceipt(packet, approvedReceipt({
      decision: "revision-required",
      checklist: {
        factualAccuracy: false,
        atomicity: true,
        subjectIdentity: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      },
      noteCodes: ["factual-issue"],
    }))).toMatchObject({
      status: "valid",
      outcome: "revision-required",
      promotionAllowed: false,
    });
  });

  it("rejects free-form note codes and malformed reviewer dates", () => {
    expect(validateHoidEditorialClaimReviewReceipt(packet, approvedReceipt({
      noteCodes: ["no-issues", "free-form narrative"],
    }))).toMatchObject({ status: "invalid" });
    expect(validateHoidEditorialClaimReviewReceipt(packet, approvedReceipt({
      reviewedAt: "yesterday",
    }))).toMatchObject({ status: "invalid", reason: "invalid-date" });
  });

  it("rejects accessor-backed packet fields without invoking getters", () => {
    let getterCalled = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "schemaVersion", {
      enumerable: true,
      get() { getterCalled = true; return 1; },
    });
    expect(validateHoidEditorialClaimReviewReceipt(hostile, approvedReceipt())).toEqual({
      status: "invalid",
      reason: "invalid-packet",
    });
    expect(getterCalled).toBe(false);
  });
});

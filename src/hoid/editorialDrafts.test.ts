import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "./sha256";
import {
  getHoidEditorialDraftStatus,
  HOID_EDITORIAL_DRAFTS,
  validateHoidEditorialDraft,
  validateHoidEditorialDraftBatch,
} from "./editorialDrafts";
import {
  createHoidEditorialRuntime,
  getHoidEditorialRegistryStatus,
} from "./editorialRegistry";

const validDraft = HOID_EDITORIAL_DRAFTS[0];

function cloneDraft(overrides: Record<string, unknown> = {}) {
  return {
    ...validDraft,
    ...overrides,
  };
}

describe("Hoid editorial draft staging", () => {
  it("binds every editorial summary to its exact UTF-8 SHA-256 digest", () => {
    expect(HOID_EDITORIAL_DRAFTS.map(draft => draft.summaryIntegrity.sha256)).toEqual([
      "f6ff4d0c396ad06b3e4869585ddec96b16fbfe29cc0bc0692a3958581f1ec64f",
      "29b89159bdb622ccefa35d97c26e997683500eb572c6979e9e2829578d6fd8b2",
      "dac6798cb130a17b714584d131204b7e4265748cdf464af8668f22f751cd7ad0",
      "bba8b74d05b28d3167bc0c0e82a8c66a53d2174b9a00249764158db5d7fc2abc",
      "71a11f952189f079a9acfdeaf46b35f4a973c499699dbcc8f943c63a5bb000f6",
      "9fa0072f28c0e8e98087e78c2663f664889cd4bcc4dca0eee963f081370f82bd",
      "fe550c8880d21a183cdd690039f6ef9b828837282558c75b0924f2311fdee36a",
      "2832f63706c3dcead79763a97373e9f218d437b0185553f0d9b784ad849f98f2",
    ]);
    for (const draft of HOID_EDITORIAL_DRAFTS) {
      expect(draft.summaryIntegrity.sha256).toBe(sha256Hex(draft.summary));
    }
  });

  it("rejects summary edits when the original digest is retained", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      summary: validDraft.summary + " Texto añadido después de la revisión.",
    }))).toEqual({ status: "invalid", reason: "invalid-summary-integrity" });
  });

  it("rejects a forged but well-formed summary digest", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      summaryIntegrity: { sha256: "a".repeat(64) },
    }))).toEqual({ status: "invalid", reason: "invalid-summary-integrity" });
  });

  it("loads the original-summary batch as pending review, not as production knowledge", () => {
    expect(getHoidEditorialDraftStatus()).toBe("pending-review");
    expect(HOID_EDITORIAL_DRAFTS).toHaveLength(8);
    expect(HOID_EDITORIAL_DRAFTS[0].review.status).toBe("pending-review");
    expect(HOID_EDITORIAL_DRAFTS[0].summaryKind).toBe("original-editorial-summary");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("stages independently sourced chapter-one and chapter-two drafts for the accessible Roshar and Cosmere EPUBs", () => {
    expect(HOID_EDITORIAL_DRAFTS.map(draft => draft.id)).toEqual([
      "twok.chapter-001.cenn-battle",
      "edgedancer.chapter-001.lift-departure",
      "dawnshard.chapter-001.akinah-expedition",
      "twok.chapter-002.kaladin-slave-caravan",
      "edgedancer.chapter-002.lift-yeddaw-arrival",
      "dawnshard.chapter-002.rysn-navani-akinah-mission",
      "tfe.chapter-001.vin",
      "tfe.chapter-002.kelsier",
    ]);
    for (const draft of HOID_EDITORIAL_DRAFTS) {
      expect([1, 2]).toContain(draft.evidenceSource.chapter);
      expect(draft.evidenceUnlock).toEqual({
        bookId: draft.evidenceSource.bookId,
        chapter: draft.evidenceSource.chapter + 1,
      });
      expect(draft.review.status).toBe("pending-review");
      expect(draft.summary.length).toBeGreaterThan(80);
    }
  });

  it("validates every staged source locator against its own edition manifest", () => {
    for (const draft of HOID_EDITORIAL_DRAFTS) {
      expect(validateHoidEditorialDraft(draft).status).toBe("valid");
    }
  });

  it("binds the draft to the exact chapter locator and chapter-document digest", () => {
    const result = validateHoidEditorialDraft(validDraft);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    expect(result.draft.evidenceSource.locatorId).toContain(":L1-012.xhtml");
    expect(result.draft.sourceIntegrity.navigationSha256).toBe(
      "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    );
    expect(result.draft.sourceIntegrity.documentSha256).toBe(
      "0853a9469afe233d415645208f04bafb7f5dd5d603af9706c8924bcf14d27a70",
    );
  });

  it("keeps the chapter-one summary locked until chapter two is reached", () => {
    expect(validDraft.evidenceSource.chapter).toBe(1);
    expect(validDraft.evidenceUnlock.chapter).toBe(2);
  });

  it("rejects a forged or mismatched navigation locator", () => {
    const source = {
      ...validDraft.evidenceSource,
      locatorId: validDraft.evidenceSource.locatorId.replace("L1-012.xhtml", "L1-013.xhtml"),
    };
    expect(validateHoidEditorialDraft(cloneDraft({ evidenceSource: source }))).toEqual({
      status: "invalid",
      reason: "invalid-evidence",
    });
  });

  it("rejects a navigation digest from another edition snapshot", () => {
    const sourceIntegrity = {
      ...validDraft.sourceIntegrity,
      navigationSha256: "a".repeat(64),
    };
    expect(validateHoidEditorialDraft(cloneDraft({ sourceIntegrity }))).toEqual({
      status: "invalid",
      reason: "invalid-source-integrity",
    });
  });

  it("rejects a malformed source document digest", () => {
    const sourceIntegrity = {
      ...validDraft.sourceIntegrity,
      documentSha256: "not-a-sha256",
    };
    expect(validateHoidEditorialDraft(cloneDraft({ sourceIntegrity }))).toEqual({
      status: "invalid",
      reason: "invalid-source-integrity",
    });
  });

  it("rejects a well-formed but unverified chapter document digest", () => {
    const sourceIntegrity = {
      ...validDraft.sourceIntegrity,
      documentSha256: "a".repeat(64),
    };
    expect(validateHoidEditorialDraft(cloneDraft({ sourceIntegrity }))).toEqual({
      status: "invalid",
      reason: "invalid-source-integrity",
    });
  });

  it("rejects an unlock threshold outside the verified chapter sequence", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      evidenceUnlock: { bookId: "twok", chapter: 0 },
    }))).toEqual({
      status: "invalid",
      reason: "invalid-evidence",
    });
  });

  it("requires first appearance to be in the same work as this v1 draft", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      firstSafeAppearance: { bookId: "wor", chapter: 1 },
    }))).toEqual({
      status: "invalid",
      reason: "invalid-appearance",
    });
  });

  it("rejects a first appearance later than the summary unlock threshold", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      firstSafeAppearance: { bookId: "twok", chapter: 3 },
    }))).toEqual({
      status: "invalid",
      reason: "invalid-appearance",
    });
  });


  it("rejects an unlock threshold that does not exist in the manifest", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      evidenceUnlock: { bookId: "twok", chapter: 76 },
    }))).toEqual({
      status: "invalid",
      reason: "invalid-evidence",
    });
  });

  it("rejects any attempt to mark a staged draft approved", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      review: { status: "approved" },
    }))).toEqual({
      status: "invalid",
      reason: "invalid-review",
    });
  });

  it("rejects accessors without executing them", () => {
    let invoked = false;
    const input = cloneDraft();
    Object.defineProperty(input, "summary", {
      enumerable: true,
      get: () => {
        invoked = true;
        return validDraft.summary;
      },
    });

    expect(validateHoidEditorialDraft(input)).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
    expect(invoked).toBe(false);
  });

  it("rejects unknown properties instead of silently normalizing them", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      rawPassage: "must never enter the editorial draft",
    }))).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
  });

  it("rejects duplicate draft IDs as a batch", () => {
    const result = validateHoidEditorialDraftBatch([validDraft, validDraft]);
    expect(result).toEqual({ status: "invalid", reason: "duplicate-id" });
  });

  it("accepts an empty staging batch without changing production status", () => {
    expect(validateHoidEditorialDraftBatch([])).toEqual({
      status: "valid",
      drafts: [],
    });
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("rejects sparse draft batches", () => {
    const sparse = new Array(1);
    expect(validateHoidEditorialDraftBatch(sparse)).toEqual({
      status: "invalid",
      reason: "invalid-batch",
    });
  });

  it("rejects custom array properties in a draft batch", () => {
    const batch = [validDraft] as typeof HOID_EDITORIAL_DRAFTS[number][] & { unexpected?: string };
    batch.unexpected = "not part of the batch contract";
    expect(validateHoidEditorialDraftBatch(batch)).toEqual({
      status: "invalid",
      reason: "invalid-batch",
    });
  });

  it("contains exceptions from hostile batch proxies", () => {
    const hostile = new Proxy([validDraft], {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      },
    });
    expect(validateHoidEditorialDraftBatch(hostile)).toEqual({
      status: "invalid",
      reason: "invalid-batch",
    });
  });

  it("never exposes a pending draft through the production answer runtime", async () => {
    const selectClaims = vi.fn(async () => []);
    const runtime = createHoidEditorialRuntime({ selectClaims });
    expect(runtime).not.toBeNull();

    const result = await runtime!.answer({
      question: "Resume el primer capítulo de El camino de los reyes",
      reading: [{ bookId: "twok", chapter: 2 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("no-authorized-evidence");
    expect(selectClaims).not.toHaveBeenCalled();
  });

  it("keeps all chapter-two summaries unavailable until chapter three is completed", () => {
    const chapterTwoDrafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.chapter === 2);
    expect(chapterTwoDrafts).toHaveLength(4);
    for (const draft of chapterTwoDrafts) {
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 3 });
      expect(draft.review.status).toBe("pending-review");
    }
  });

});

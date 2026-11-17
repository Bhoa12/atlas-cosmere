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
      "2fe2105e123b4748ac8592e614e2bc20b5857279ff9876a8c76a49ba80da6ce0",
      "f8f95da0b83d9485b47a2fd001a137f5b01c032924a8b67be6131720ca813951",
      "da18ca2f77a275d8d7db1e69f14e64731adb53c13bd9c97e0eaf294c99e998ac",
      "8e0158b020211d36b279ca8bdb9c0cc338e3117f4f47b4de6a2352a5a6a3e80d",
      "48b7f0e60d6d462a7a6c45f6c211d4ff81638da9e15f76210d2c71d1413ae313",
      "22acb4f51b8c3f421da85d7bd1b85e1889b8ab22f9db882cef43c9040a583bf9",
      "50994fd820c5f81246f12544412891810836c50e49c709fe0c8df51f03cfd1d5",
      "dcad662155a8d6e87c79eef48b4d7e55e591a434fae4131b6d23be7214e84111",
      "65d8e0cb15f2109e5bf2b95ef52e59be8185176eb1b5724ce0866df5dea9ea6f",
      "3a702f5cf75e56b4765f9ae5983765a7a19c1d8fba68c9aaf4094db37d8eeac8",
      "970c0970240499bb55e047902cfb2889795277e3009adcaa0d2b46d1d1bb3372",
      "e701f34a58137d705dbe4829682b29c2f424a88017bcd41751d8110ebc9a7bd5",
      "10c850eaefe0ded795c175f8b9e6ffeba49a02808e746b138d2105b3c327951b",
      "006c275d6a9539b5ebdff94228ef5cc10576ed13b88751967d574aa4ee36fc24",
      "fc38f6238ac4f8bd52f544543f63afa5d5e0cff5a6e02ce0f6b0f0c0e4033854",
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
    expect(HOID_EDITORIAL_DRAFTS).toHaveLength(23);
    expect(HOID_EDITORIAL_DRAFTS[0].review.status).toBe("pending-review");
    expect(HOID_EDITORIAL_DRAFTS[0].summaryKind).toBe("original-editorial-summary");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("stages independently sourced chapter-one through chapter-seven drafts for the accessible EPUBs", () => {
    expect(HOID_EDITORIAL_DRAFTS.map(draft => draft.id)).toEqual([
      "twok.chapter-001.cenn-battle",
      "edgedancer.chapter-001.lift-departure",
      "dawnshard.chapter-001.akinah-expedition",
      "twok.chapter-002.kaladin-slave-caravan",
      "edgedancer.chapter-002.lift-yeddaw-arrival",
      "dawnshard.chapter-002.rysn-navani-akinah-mission",
      "tfe.chapter-001.vin",
      "tfe.chapter-002.kelsier",
      "twok.chapter-003.shallan-kharbranth",
      "edgedancer.chapter-003.hauka-grain-cart",
      "dawnshard.chapter-003.lopen-talik-delegation",
      "twok.chapter-004.kaladin-highstorm-camp",
      "edgedancer.chapter-004.lift-immigrant-district",
      "dawnshard.chapter-004.rysn-crew-trust",
      "twok.chapter-005.shallan-jasnah-assessment",
      "edgedancer.chapter-005.lift-remembering-forgotten",
      "dawnshard.chapter-005.rysn-lopen-fabrial-demonstration",
      "twok.chapter-006.kaladin-bridge-four",
      "edgedancer.chapter-006.lift-tashikk-orphanage",
      "dawnshard.chapter-006.rysn-worm-grain-trade",
      "twok.chapter-007.shallan-palanaeum-wait",
      "edgedancer.chapter-007.lift-tracks-darkness",
      "dawnshard.chapter-007.lopen-crew-unease",
    ]);
    for (const draft of HOID_EDITORIAL_DRAFTS) {
      expect([1, 2, 3, 4, 5, 6, 7]).toContain(draft.evidenceSource.chapter);
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

  it("keeps all chapter-three summaries unavailable until chapter four is completed", () => {
    const chapterThreeDrafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.chapter === 3);
    expect(chapterThreeDrafts).toHaveLength(3);
    for (const draft of chapterThreeDrafts) {
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 4 });
      expect(draft.review.status).toBe("pending-review");
    }
  });

  it("keeps all chapter-four summaries unavailable until chapter five is completed", () => {
    const chapterFourDrafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.chapter === 4);
    expect(chapterFourDrafts).toHaveLength(3);
    for (const draft of chapterFourDrafts) {
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 5 });
      expect(draft.review.status).toBe("pending-review");
    }
  });

  it("keeps all chapter-five summaries unavailable until chapter six is completed", () => {
    const chapterFiveDrafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.chapter === 5);
    expect(chapterFiveDrafts).toHaveLength(3);
    for (const draft of chapterFiveDrafts) {
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 6 });
      expect(draft.review.status).toBe("pending-review");
    }
  });

  it("keeps all chapter-two summaries unavailable until chapter three is completed", () => {
    const chapterTwoDrafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.chapter === 2);
    expect(chapterTwoDrafts).toHaveLength(4);
    for (const draft of chapterTwoDrafts) {
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 3 });
      expect(draft.review.status).toBe("pending-review");
    }
  });


  it("keeps all chapter-seven summaries unavailable until chapter eight is completed", () => {
    const chapterSevenDrafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.chapter === 7);
    expect(chapterSevenDrafts).toHaveLength(3);
    for (const draft of chapterSevenDrafts) {
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 8 });
      expect(draft.review.status).toBe("pending-review");
    }
  });

  it("keeps all chapter-six summaries unavailable until chapter seven is completed", () => {
    const chapterSixDrafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.chapter === 6);
    expect(chapterSixDrafts).toHaveLength(3);
    for (const draft of chapterSixDrafts) {
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 7 });
      expect(draft.review.status).toBe("pending-review");
    }
  });


});

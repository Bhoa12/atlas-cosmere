import { describe, expect, it, vi } from "vitest";
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
  it("loads one original summary as pending review, not as production knowledge", () => {
    expect(getHoidEditorialDraftStatus()).toBe("pending-review");
    expect(HOID_EDITORIAL_DRAFTS).toHaveLength(3);
    expect(HOID_EDITORIAL_DRAFTS[0].review.status).toBe("pending-review");
    expect(HOID_EDITORIAL_DRAFTS[0].summaryKind).toBe("original-editorial-summary");
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("stages one independently sourced chapter-one draft for each accessible Roshar EPUB", () => {
    expect(HOID_EDITORIAL_DRAFTS.map(draft => draft.id)).toEqual([
      "twok.chapter-001.cenn-battle",
      "edgedancer.chapter-001.lift-departure",
      "dawnshard.chapter-001.akinah-expedition",
    ]);
    for (const draft of HOID_EDITORIAL_DRAFTS) {
      expect(draft.evidenceSource.chapter).toBe(1);
      expect(draft.evidenceUnlock).toEqual({ bookId: draft.evidenceSource.bookId, chapter: 2 });
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

  it("rejects an unlock threshold earlier than the source chapter", () => {
    expect(validateHoidEditorialDraft(cloneDraft({
      evidenceUnlock: { bookId: "twok", chapter: 1 },
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
});

import { describe, expect, it } from "vitest";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { HOID_EXPLANATION_DEPTH_BUDGETS, presentHoidExplanation } from "./explanationDepth";

const updatedAt = "2026-11-20T00:00:00.000Z";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Test manifest unavailable");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Test locator unavailable");
  return unit.locatorId;
}

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Test cursor unavailable");
  return result.cursor;
}

function progressAt(bookIds: readonly string[], chapter = 3) {
  return {
    schemaVersion: 2,
    revision: 1,
    positions: bookIds.map((bookId, index) => ({
      bookId,
      cursor: cursor(bookId, chapter),
      order: index + 1,
    })),
    updatedAt,
  };
}

function source(bookId: string, evidenceId: string, unlockChapter = 2) {
  return {
    evidenceId,
    sourceBookId: bookId,
    sourceChapter: 1,
    locatorId: locator(bookId, 1),
    unlockBookId: bookId,
    unlockChapter,
  };
}

type TestSegment = Readonly<{
  claimId: string;
  text: string;
  evidenceIds: readonly string[];
}>;

function answer(
  segments: readonly TestSegment[],
  sources: readonly ReturnType<typeof source>[],
  includeSegments = true,
  layout: "plain" | "numbered" = "plain",
) {
  const text = layout === "numbered"
    ? segments.map((segment, index) => String(index + 1) + ". " + segment.text).join("\n\n")
    : segments.map(segment => segment.text).join("\n\n");
  return {
    status: "authorized",
    text,
    claimIds: segments.map(segment => segment.claimId),
    evidenceIds: sources.map(item => item.evidenceId),
    sources,
    ...(includeSegments ? { layout, segments } : {}),
  };
}

describe("Hoid explanation depth policy", () => {
  it("accepts a concise answer with exact claim-level source provenance", () => {
    const evidence = source("tfe", "evidence-vin-ch1");
    const input = answer(
      [{ claimId: "claim-vin", text: "Afirmación verificada.", evidenceIds: [evidence.evidenceId] }],
      [evidence],
    );

    const result = presentHoidExplanation(input, progressAt(["tfe"]), "brief");

    expect(result).toMatchObject({
      status: "ready",
      depth: "brief",
      metrics: { claimCount: 1, evidenceCount: 1, workCount: 1 },
      presentation: { status: "ready", text: "Afirmación verificada.", segments: [{ claimId: "claim-vin", evidenceIds: ["evidence-vin-ch1"] }] },
    });
  });

  it("requires claim-level provenance in every public explanation depth", () => {
    for (const budget of Object.values(HOID_EXPLANATION_DEPTH_BUDGETS)) {
      expect(budget.requireSegmentProvenance).toBe(true);
    }
    expect(HOID_EXPLANATION_DEPTH_BUDGETS.comparative.requireCrossWorkSegment).toBe(true);
    expect(HOID_EXPLANATION_DEPTH_BUDGETS.brief.requireCrossWorkSegment).toBe(false);
    expect(HOID_EXPLANATION_DEPTH_BUDGETS.detailed.requireCrossWorkSegment).toBe(false);
  });

  it.each(["brief", "detailed", "comparative"] as const)(
    "withholds %s answers that omit the claim-to-evidence map",
    depth => {
      const evidence = source("tfe", "evidence-vin-ch1");
      const input = answer(
        [{ claimId: "claim-vin", text: "Afirmación sin mapa de procedencia.", evidenceIds: [evidence.evidenceId] }],
        [evidence],
        false,
      );

      const result = presentHoidExplanation(input, progressAt(["tfe"]), depth);

      expect(result).toMatchObject({
        status: "withheld",
        reason: "segment-provenance-required",
      });
      expect(result).not.toHaveProperty("presentation");
      expect(JSON.stringify(result)).not.toContain("Afirmación sin mapa de procedencia.");
    },
  );

  it("allows a detailed explanation to use several already-authorized works", () => {
    const first = source("tfe", "evidence-vin-ch1");
    const second = source("twok", "evidence-kal-ch1");
    const segments = [
      { claimId: "claim-one", text: "Primera afirmación.", evidenceIds: [first.evidenceId] },
      { claimId: "claim-two", text: "Segunda afirmación.", evidenceIds: [second.evidenceId] },
      { claimId: "claim-three", text: "Tercera afirmación.", evidenceIds: [first.evidenceId, second.evidenceId] },
      { claimId: "claim-four", text: "Cuarta afirmación.", evidenceIds: [first.evidenceId] },
    ];

    const result = presentHoidExplanation(
      answer(segments, [first, second], true, "numbered"),
      progressAt(["tfe", "twok"]),
      "detailed",
    );

    expect(result).toMatchObject({
      status: "ready",
      depth: "detailed",
      metrics: { claimCount: 4, evidenceCount: 2, workCount: 2 },
    });
    if (result.status !== "ready") throw new Error("Expected detailed explanation");
    expect(result.presentation.text).toContain("Primera afirmación.");
    expect(result.presentation.segments).toHaveLength(4);
  });

  it("withholds an oversized brief answer instead of silently truncating claims", () => {
    const evidence = source("tfe", "evidence-vin-ch1");
    const segments = Array.from({ length: 4 }, (_, index) => ({
      claimId: "claim-" + String(index + 1),
      text: "Afirmación " + String(index + 1) + ".",
      evidenceIds: [evidence.evidenceId],
    }));

    const result = presentHoidExplanation(
      answer(segments, [evidence]),
      progressAt(["tfe"]),
      "brief",
    );

    expect(result).toMatchObject({ status: "withheld", reason: "depth-budget-exceeded" });
    expect(result).not.toHaveProperty("presentation");
  });

  it("requires comparative claims to map to evidence from at least two works", () => {
    const first = source("tfe", "evidence-vin-ch1");
    const second = source("twok", "evidence-kal-ch1");
    const segments = [{
      claimId: "claim-comparison",
      text: "Comparación respaldada por dos obras.",
      evidenceIds: [first.evidenceId, second.evidenceId],
    }];

    const result = presentHoidExplanation(
      answer(segments, [first, second], true),
      progressAt(["tfe", "twok"]),
      "comparative",
    );

    expect(result).toMatchObject({
      status: "ready",
      depth: "comparative",
      metrics: { claimCount: 1, evidenceCount: 2, workCount: 2 },
    });
  });

  it("rejects comparative mode when evidence comes from only one work", () => {
    const evidence = source("tfe", "evidence-vin-ch1");
    const segments = [{
      claimId: "claim-comparison",
      text: "No hay evidencia cruzada.",
      evidenceIds: [evidence.evidenceId],
    }];

    expect(presentHoidExplanation(
      answer(segments, [evidence], true),
      progressAt(["tfe"]),
      "comparative",
    )).toMatchObject({
      status: "withheld",
      reason: "comparison-provenance-required",
    });
  });

  it("rejects a comparative answer whose claims never map across works", () => {
    const first = source("tfe", "evidence-vin-ch1");
    const second = source("twok", "evidence-kal-ch1");
    const segments = [
      { claimId: "claim-one", text: "Afirmación de una obra.", evidenceIds: [first.evidenceId] },
      { claimId: "claim-two", text: "Afirmación de otra obra.", evidenceIds: [second.evidenceId] },
    ];

    expect(presentHoidExplanation(
      answer(segments, [first, second], true),
      progressAt(["tfe", "twok"]),
      "comparative",
    )).toMatchObject({
      status: "withheld",
      reason: "comparison-provenance-required",
    });
  });

  it("preserves the source-level spoiler gate for every work in a comparison", () => {
    const first = source("tfe", "evidence-vin-ch1");
    const second = source("twok", "evidence-kal-ch1", 4);
    const segments = [{
      claimId: "claim-comparison",
      text: "Comparación con una fuente todavía bloqueada.",
      evidenceIds: [first.evidenceId, second.evidenceId],
    }];

    expect(presentHoidExplanation(
      answer(segments, [first, second], true),
      progressAt(["tfe", "twok"], 3),
      "comparative",
    )).toMatchObject({ status: "withheld", reason: "locked-evidence" });
  });

  it("rejects unsupported depth values and exposes no answer text", () => {
    const evidence = source("tfe", "evidence-vin-ch1");
    const input = answer(
      [{ claimId: "claim-vin", text: "Afirmación verificada.", evidenceIds: [evidence.evidenceId] }],
      [evidence],
    );

    const result = presentHoidExplanation(input, progressAt(["tfe"]), "unlimited");

    expect(result).toMatchObject({ status: "withheld", reason: "invalid-depth" });
    expect(JSON.stringify(result)).not.toContain("Afirmación verificada.");
  });
});

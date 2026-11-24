import { describe, expect, it } from "vitest";
import type { HoidAnswerPresentation, HoidPresentedCitation } from "./answerPresentation";
import type { HoidCrossBookEvidenceSummary } from "./crossBookEvidence";
import { getHoidReadingManifest } from "./readingManifest";
import {
  projectHoidAnswerForDisplay,
  projectHoidCrossBookEvidenceForDisplay,
} from "./answerDisplayProjection";

const elantrisManifest = getHoidReadingManifest("elantris");
if (elantrisManifest.status !== "ready") throw new Error("Elantris manifest fixture unavailable");
const elantrisChapterFour = elantrisManifest.manifest.units.find(unit => unit.chapterNumber === 4);
if (!elantrisChapterFour?.locatorId) throw new Error("Elantris chapter-four locator unavailable");

const citation: HoidPresentedCitation = Object.freeze({
  evidenceId: "evidence-one",
  sourceBookId: "elantris",
  title: "Elantris",
  chapter: 4,
  locatorId: elantrisChapterFour.locatorId,
});

function readyPresentation(
  overrides: Partial<Extract<HoidAnswerPresentation, { status: "ready" }>> = {},
): Extract<HoidAnswerPresentation, { status: "ready" }> {
  return Object.freeze({
    status: "ready",
    text: "Explicación respaldada.",
    claimIds: Object.freeze(["claim-one"]),
    evidenceIds: Object.freeze(["evidence-one"]),
    citations: Object.freeze([citation]),
    layout: "plain",
    segments: Object.freeze([Object.freeze({
      claimId: "claim-one",
      text: "Explicación respaldada.",
      evidenceIds: Object.freeze(["evidence-one"]),
      citations: Object.freeze([citation]),
    })]),
    ...overrides,
  });
}

function crossBookSummary(): HoidCrossBookEvidenceSummary {
  const elantris = Object.freeze({
    sourceBookId: "elantris",
    title: "Elantris",
    chapters: Object.freeze([4]),
    evidenceIds: Object.freeze(["evidence-one"]),
  });
  const warbreaker = Object.freeze({
    sourceBookId: "warbreaker",
    title: "El aliento de los dioses",
    chapters: Object.freeze([2, 5]),
    evidenceIds: Object.freeze(["evidence-two", "evidence-three"]),
  });
  return Object.freeze({
    workCount: 2,
    works: Object.freeze([elantris, warbreaker]),
    segments: Object.freeze([Object.freeze({
      claimId: "claim-one",
      sourceBookIds: Object.freeze(["elantris", "warbreaker"]),
      works: Object.freeze([elantris, warbreaker]),
    })]),
  });
}

describe("Hoid answer display projection", () => {
  it("strips EPUB locators and evidence IDs from visible citations", () => {
    const display = projectHoidAnswerForDisplay(readyPresentation());
    expect(display).not.toBeNull();
    expect(display!.citations[0]).toEqual({
      sourceBookId: "elantris",
      title: "Elantris",
      chapter: 4,
      chapterOrdinal: 4,
      chapterLabelAmbiguous: false,
    });
    expect(Object.keys(display!.citations[0]).sort()).toEqual([
      "chapter",
      "chapterLabelAmbiguous",
      "chapterOrdinal",
      "sourceBookId",
      "title",
    ]);
    expect(JSON.stringify(display)).not.toContain("private.xhtml");
    expect(JSON.stringify(display)).not.toContain("locatorId");
    expect(JSON.stringify(display)).not.toContain("evidence-one");
    expect(JSON.stringify(display)).not.toContain("unlockChapter");
  });

  it("strips raw evidence lists while preserving claim-to-source attribution", () => {
    const display = projectHoidAnswerForDisplay(readyPresentation());
    expect(display?.segments?.[0]).toEqual({
      claimId: "claim-one",
      text: "Explicación respaldada.",
      citations: [{
        sourceBookId: "elantris",
        title: "Elantris",
        chapter: 4,
        chapterOrdinal: 4,
        chapterLabelAmbiguous: false,
      }],
    });
    expect(display?.segments?.[0]).not.toHaveProperty("evidenceIds");
    expect(display).not.toHaveProperty("claimIds");
    expect(display).not.toHaveProperty("evidenceIds");
  });

  it("creates a detached, deeply frozen display projection", () => {
    const source = readyPresentation();
    const display = projectHoidAnswerForDisplay(source);
    expect(display).not.toBeNull();
    expect(display).not.toBe(source);
    expect(Object.isFrozen(display)).toBe(true);
    expect(Object.isFrozen(display!.citations)).toBe(true);
    expect(Object.isFrozen(display!.citations[0])).toBe(true);
    expect(Object.isFrozen(display!.segments)).toBe(true);
    expect(Object.isFrozen(display!.segments![0])).toBe(true);
    expect(Object.isFrozen(display!.segments![0].citations)).toBe(true);
    expect(Object.isFrozen(display!.segments![0].citations[0])).toBe(true);
  });

  it("supports non-segmented trusted answers without retaining absent fields", () => {
    const display = projectHoidAnswerForDisplay(readyPresentation({
      layout: undefined,
      segments: undefined,
    }));
    expect(display).toEqual({
      text: "Explicación respaldada.",
      citations: [{
        sourceBookId: "elantris",
        title: "Elantris",
        chapter: 4,
        chapterOrdinal: 4,
        chapterLabelAmbiguous: false,
      }],
    });
    expect(display).not.toHaveProperty("layout");
    expect(display).not.toHaveProperty("segments");
  });

  it("rejects incomplete segment presentation contracts", () => {
    expect(projectHoidAnswerForDisplay(readyPresentation({
      layout: undefined,
    }))).toBeNull();
    expect(projectHoidAnswerForDisplay(readyPresentation({
      segments: undefined,
    }))).toBeNull();
  });

  it("rejects an empty segmented answer instead of hiding the answer text", () => {
    expect(projectHoidAnswerForDisplay(readyPresentation({
      segments: Object.freeze([]),
    }))).toBeNull();
  });

  it("disambiguates a repeated chapter label using its exact locator without exposing that locator", () => {
    const manifest = getHoidReadingManifest("sawt");
    expect(manifest.status).toBe("ready");
    if (manifest.status !== "ready") return;
    const duplicateUnits = manifest.manifest.units.filter(unit => unit.chapterNumber === 12);
    expect(duplicateUnits).toHaveLength(2);

    for (const unit of duplicateUnits) {
      if (!unit.locatorId) throw new Error("Duplicate chapter locator must be verified");
      const exactCitation: HoidPresentedCitation = Object.freeze({
        evidenceId: "evidence-" + String(unit.ordinal),
        sourceBookId: "sawt",
        title: "Viento y verdad",
        chapter: 12,
        locatorId: unit.locatorId,
      });
      const display = projectHoidAnswerForDisplay(readyPresentation({
        evidenceIds: Object.freeze([exactCitation.evidenceId]),
        citations: Object.freeze([exactCitation]),
        segments: Object.freeze([Object.freeze({
          claimId: "claim-one",
          text: "Explicación respaldada.",
          evidenceIds: Object.freeze([exactCitation.evidenceId]),
          citations: Object.freeze([exactCitation]),
        })]),
      }));
      expect(display?.citations[0]).toEqual({
        sourceBookId: "sawt",
        title: "Viento y verdad",
        chapter: 12,
        chapterOrdinal: unit.ordinal,
        chapterLabelAmbiguous: true,
      });
      expect(JSON.stringify(display)).not.toContain(unit.locatorId);
      expect(JSON.stringify(display)).not.toContain(exactCitation.evidenceId);
    }
  });

  it("rejects cross-book summaries that contain an ambiguous chapter without an exact locator", () => {
    const sawt = Object.freeze({
      sourceBookId: "sawt",
      title: "Viento y verdad",
      chapters: Object.freeze([12]),
      evidenceIds: Object.freeze(["evidence-sawt"]),
    });
    const elantris = Object.freeze({
      sourceBookId: "elantris",
      title: "Elantris",
      chapters: Object.freeze([4]),
      evidenceIds: Object.freeze(["evidence-one"]),
    });
    expect(projectHoidCrossBookEvidenceForDisplay({
      workCount: 2,
      works: Object.freeze([elantris, sawt]),
      segments: Object.freeze([Object.freeze({
        claimId: "claim-one",
        sourceBookIds: Object.freeze(["elantris", "sawt"]),
        works: Object.freeze([elantris, sawt]),
      })]),
    })).toBeNull();
  });

  it("removes evidence IDs and source-ID lists from cross-work display summaries", () => {
    const display = projectHoidCrossBookEvidenceForDisplay(crossBookSummary());
    expect(display).toEqual({
      workCount: 2,
      works: [
        { sourceBookId: "elantris", title: "Elantris", chapters: [4] },
        { sourceBookId: "warbreaker", title: "El aliento de los dioses", chapters: [2, 5] },
      ],
      segments: [{
        claimId: "claim-one",
        works: [
          { sourceBookId: "elantris", title: "Elantris", chapters: [4] },
          { sourceBookId: "warbreaker", title: "El aliento de los dioses", chapters: [2, 5] },
        ],
      }],
    });
    expect(JSON.stringify(display)).not.toContain("evidence-one");
    expect(JSON.stringify(display)).not.toContain("sourceBookIds");
    expect(JSON.stringify(display)).not.toContain("evidenceIds");
  });

  it("deeply freezes the cross-work display summary", () => {
    const display = projectHoidCrossBookEvidenceForDisplay(crossBookSummary());
    expect(Object.isFrozen(display)).toBe(true);
    expect(Object.isFrozen(display!.works)).toBe(true);
    expect(Object.isFrozen(display!.works[0])).toBe(true);
    expect(Object.isFrozen(display!.works[0].chapters)).toBe(true);
    expect(Object.isFrozen(display!.segments)).toBe(true);
    expect(Object.isFrozen(display!.segments[0].works)).toBe(true);
  });

  it("rejects an inconsistent cross-work summary", () => {
    expect(projectHoidCrossBookEvidenceForDisplay({
      ...crossBookSummary(),
      workCount: 3,
    })).toBeNull();
  });
});

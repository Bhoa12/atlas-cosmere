import { describe, expect, it } from "vitest";
import type { HoidAnswerPresentation, HoidPresentedCitation } from "./answerPresentation";
import { projectHoidAnswerForDisplay } from "./answerDisplayProjection";

const citation: HoidPresentedCitation = Object.freeze({
  evidenceId: "evidence-one",
  sourceBookId: "elantris",
  title: "Elantris",
  chapter: 4,
  locatorId: "private.xhtml#chapter-4",
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

describe("Hoid answer display projection", () => {
  it("strips EPUB locators and unlock metadata from top-level citations", () => {
    const display = projectHoidAnswerForDisplay(readyPresentation());
    expect(display).not.toBeNull();
    expect(display!.citations[0]).toEqual({
      evidenceId: "evidence-one",
      sourceBookId: "elantris",
      title: "Elantris",
      chapter: 4,
    });
    expect(Object.keys(display!.citations[0]).sort()).toEqual([
      "chapter",
      "evidenceId",
      "sourceBookId",
      "title",
    ]);
    expect(JSON.stringify(display)).not.toContain("private.xhtml");
    expect(JSON.stringify(display)).not.toContain("locatorId");
    expect(JSON.stringify(display)).not.toContain("unlockChapter");
  });

  it("strips raw evidence lists while preserving claim-to-source attribution", () => {
    const display = projectHoidAnswerForDisplay(readyPresentation());
    expect(display?.segments?.[0]).toEqual({
      claimId: "claim-one",
      text: "Explicación respaldada.",
      citations: [{
        evidenceId: "evidence-one",
        sourceBookId: "elantris",
        title: "Elantris",
        chapter: 4,
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
    expect(display!.citations[0]).not.toBe(citation);
  });

  it("supports non-segmented trusted answers without retaining absent fields", () => {
    const display = projectHoidAnswerForDisplay(readyPresentation({
      layout: undefined,
      segments: undefined,
    }));
    expect(display).toEqual({
      text: "Explicación respaldada.",
      citations: [{
        evidenceId: "evidence-one",
        sourceBookId: "elantris",
        title: "Elantris",
        chapter: 4,
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
});

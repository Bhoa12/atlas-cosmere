import { recommendReadingNextSteps, recommendUnstartedSources, recommendUnstartedSourcesFromUnknown } from "./recommendations";

describe("recommendUnstartedSources", () => {
  it("returns metadata-only recommendations for verified sources not yet started", () => {
    const recommendations = recommendUnstartedSources(
      [{ bookId: "tfe", chapter: 1 }],
      2,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations.every(item => item.reason === "unread-source")).toBe(true);
    expect(recommendations.some(item => item.sourceId === "tfe")).toBe(false);
  });

  it("does not let unknown progress suppress verified recommendations", () => {
    const recommendations = recommendUnstartedSources(
      [{ bookId: "unknown-source", chapter: 999 }],
      1,
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].sourceId).toBe("tfe");
  });

  it("fails closed for invalid limits or malformed reading state", () => {
    expect(recommendUnstartedSources([], Number.NaN)).toEqual([]);
    expect(recommendUnstartedSources([], -1)).toEqual([]);
    expect(recommendUnstartedSourcesFromUnknown({ bookId: "tfe" })).toEqual([]);
  });

  it("fails closed for ambiguous or malformed direct progress", () => {
    expect(recommendUnstartedSources([
      { bookId: "tfe", chapter: 1 },
      { bookId: "tfe", chapter: 99 },
    ], 1)).toEqual([]);

    expect(recommendUnstartedSources([
      { bookId: "tfe", chapter: Number.POSITIVE_INFINITY },
    ] as any, 1)).toEqual([]);
  });
});

describe("recommendReadingNextSteps", () => {
  it("puts a single resumable work first and fills the remaining limit with unread sources", async () => {
    const recommendations = recommendReadingNextSteps(
      [{ bookId: "tfe", chapter: 8 }],
      2,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]).toEqual({
      sourceId: "tfe",
      title: "El Imperio Final",
      reason: "resume-current-work",
      currentChapter: 9,
      completedThroughChapter: 8,
    });
    expect(recommendations[1].reason).toBe("unread-source");
    expect(recommendations[1].sourceId).not.toBe("tfe");
  });

  it("recommends the next chapter after the completed-through watermark", async () => {
    expect(recommendReadingNextSteps([{ bookId: "tfe", chapter: 1 }], 1)[0]).toMatchObject({
      reason: "resume-current-work",
      currentChapter: 2,
      completedThroughChapter: 1,
    });
  });

  it("does not guess which work to resume when several works are in progress", async () => {
    const recommendations = recommendReadingNextSteps([
      { bookId: "tfe", chapter: 8 },
      { bookId: "elantris", chapter: 3 },
    ], 2);

    expect(recommendations.every(item => item.reason === "unread-source")).toBe(true);
    expect(recommendations.some(item => item.sourceId === "tfe" || item.sourceId === "elantris")).toBe(false);
  });

  it("uses an explicit active work to resolve multiple in-progress works", async () => {
    const recommendations = recommendReadingNextSteps([
      { bookId: "tfe", chapter: 8 },
      { bookId: "elantris", chapter: 3 },
    ], 1, "elantris");

    expect(recommendations).toEqual([{
      sourceId: "elantris",
      title: "Elantris",
      reason: "resume-current-work",
      currentChapter: 4,
      completedThroughChapter: 3,
    }]);
  });

  it("never resumes a completed work", async () => {
    const recommendations = recommendReadingNextSteps([{ bookId: "tfe", completed: true }], 1);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].reason).toBe("unread-source");
    expect(recommendations[0].sourceId).not.toBe("tfe");
  });

  it("fails closed for out-of-range and ambiguous chapter progress", async () => {
    expect(recommendReadingNextSteps([{ bookId: "tfe", chapter: 39 }], 3)).toEqual([]);
    expect(recommendReadingNextSteps([{ bookId: "elantris", chapter: 48 }], 3)).toEqual([]);
  });

  it("does not resume past the verified numeric prefix of an ambiguous edition", async () => {
    const recommendations = recommendReadingNextSteps([{ bookId: "elantris", chapter: 47 }], 1);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].reason).toBe("unread-source");
    expect(recommendations[0].sourceId).not.toBe("elantris");
  });

  it("does not infer a numeric resume position for unsegmented works", async () => {
    expect(recommendReadingNextSteps([{ bookId: "white-sand-1", chapter: 1 }], 3)).toEqual([]);
  });

  it("applies the overall limit after prioritizing the resume item", async () => {
    expect(recommendReadingNextSteps([{ bookId: "tfe", chapter: 8 }], 1)).toHaveLength(1);
  });

  it("rejects an unknown explicit active work instead of guessing", async () => {
    expect(recommendReadingNextSteps([{ bookId: "tfe", chapter: 8 }], 3, "unknown-work")).toEqual([]);
  });
});

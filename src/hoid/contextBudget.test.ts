import { boundAuthorizedContext } from "./contextBudget";

describe("boundAuthorizedContext", () => {
  it("caps authorized context deterministically", () => {
    const entries = Array.from({ length: 4 }, (_, index) => ({ id: String(index) }));
    expect(boundAuthorizedContext(entries as any, 2)).toHaveLength(2);
  });

  it("fails closed for invalid limits", () => {
    expect(boundAuthorizedContext([{ id: "safe" }] as any, 0)).toEqual([]);
    expect(boundAuthorizedContext([{ id: "safe" }] as any, Number.NaN)).toEqual([]);
  });

  it("caps total metadata volume and skips an oversized entry", () => {
    const entries = [
      {
        id: "oversized",
        aliases: ["alias"],
        kind: "concept",
        firstSafeAppearance: { bookId: "book", chapter: 1 },
        summary: "x".repeat(100),
      },
      {
        id: "safe",
        aliases: ["ok"],
        kind: "concept",
        firstSafeAppearance: { bookId: "book", chapter: 1 },
        summary: "short",
      },
    ] as any;

    const context = boundAuthorizedContext(entries, 2, 40);
    expect(context.map(entry => entry.id)).toEqual(["safe"]);
  });

  it("counts aliases that cross the contextual provider boundary", () => {
    const entries = [{
      id: "safe",
      aliases: ["x".repeat(10_000)],
      kind: "concept",
      firstSafeAppearance: { bookId: "book", chapter: 1 },
      summary: "short",
    }] as any;

    // Contextual providers receive HoidKnowledgeEntry aliases, so an oversized
    // alias must not bypass the character budget.
    expect(boundAuthorizedContext(entries, 1, 25)).toEqual([]);
  });

  it("fails closed for invalid character limits", () => {
    expect(boundAuthorizedContext([{ id: "safe" }] as any, 1, 0)).toEqual([]);
    expect(boundAuthorizedContext([{ id: "safe" }] as any, 1, Number.NaN)).toEqual([]);
  });

  it("detaches provider context from catalog metadata", () => {
    const entries = [{
      id: "safe",
      aliases: ["alias"],
      kind: "concept",
      firstSafeAppearance: { bookId: "book", chapter: 1 },
    }] as any;

    const context = boundAuthorizedContext(entries, 1);
    context[0].aliases.push("provider-mutation");
    context[0].firstSafeAppearance.chapter = 99;

    expect(entries[0].aliases).toEqual(["alias"]);
    expect(entries[0].firstSafeAppearance.chapter).toBe(1);
  });
});

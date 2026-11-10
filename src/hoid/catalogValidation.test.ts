import { isValidKnowledgeEntry, validatedKnowledge } from "./catalogValidation";
import { HoidKnowledgeEntry } from "./catalog";

const valid: HoidKnowledgeEntry = {
  id: "safe-entry",
  aliases: ["Safe"],
  kind: "concept",
  firstSafeAppearance: { bookId: "book-a", chapter: 1 },
};

describe("catalogValidation", () => {
  it("accepts entries with canonical first-safe-appearance metadata", () => {
    expect(isValidKnowledgeEntry(valid)).toBe(true);
  });

  it("fails closed for invalid book identifiers and chapter metadata", () => {
    const blankBook = {
      ...valid,
      firstSafeAppearance: { bookId: "   ", chapter: 1 },
    };
    const invalidChapter = {
      ...valid,
      firstSafeAppearance: { bookId: "book-a", chapter: Number.NaN },
    };

    expect(validatedKnowledge([valid, blankBook, invalidChapter])).toEqual([valid]);
  });

  it("fails closed for fractional chapter metadata", () => {
    const fractionalChapter = {
      ...valid,
      firstSafeAppearance: { bookId: "book-a", chapter: 1.5 },
    };

    expect(isValidKnowledgeEntry(fractionalChapter)).toBe(false);
    expect(validatedKnowledge([valid, fractionalChapter])).toEqual([valid]);
  });

  it("fails closed for duplicate knowledge identities", () => {
    const duplicate = {
      ...valid,
      aliases: ["Different alias"],
      firstSafeAppearance: { bookId: "book-b", chapter: 9 },
    };

    expect(validatedKnowledge([valid, duplicate])).toEqual([]);
  });

  it("fails closed for normalized duplicate knowledge identities", () => {
    const equivalent = {
      ...valid,
      id: "  SAFE-ENTRY  ",
      aliases: ["Different alias"],
      firstSafeAppearance: { bookId: "book-b", chapter: 9 },
    };

    expect(validatedKnowledge([valid, equivalent])).toEqual([]);
  });

  it("fails closed when an entry has no usable catalog alias", () => {
    const emptyAliases = { ...valid, aliases: [] };
    const blankAliases = { ...valid, aliases: ["   "] };
    const malformedAliases = { ...valid, aliases: [123 as unknown as string] };

    expect(isValidKnowledgeEntry(emptyAliases)).toBe(false);
    expect(isValidKnowledgeEntry(blankAliases)).toBe(false);
    expect(isValidKnowledgeEntry(malformedAliases)).toBe(false);
    expect(validatedKnowledge([valid, emptyAliases, blankAliases, malformedAliases])).toEqual([valid]);
  });
});

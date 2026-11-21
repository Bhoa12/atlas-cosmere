import { isValidKnowledgeEntry, validatedKnowledge } from "./catalogValidation";
import { HoidKnowledgeEntry } from "./catalog";

const valid: HoidKnowledgeEntry = {
  id: "safe-entry",
  aliases: ["Safe"],
  kind: "concept",
  firstSafeAppearance: { bookId: "tfe", chapter: 1 },
};

function withId(id: string, chapter = 2): HoidKnowledgeEntry {
  return {
    ...valid,
    id,
    aliases: ["Alias " + id],
    firstSafeAppearance: { bookId: "tfe", chapter },
  };
}

describe("catalogValidation shared canonical boundary", () => {
  it("accepts entries whose first-safe appearance exists in a verified manifest", () => {
    expect(isValidKnowledgeEntry(valid)).toBe(true);
    expect(validatedKnowledge([valid])).toEqual([valid]);
  });

  it("rejects unknown works, nonexistent chapters and invalid chapter numbers", () => {
    const unknownBook = {
      ...valid,
      firstSafeAppearance: { bookId: "not-a-catalog-book", chapter: 1 },
    };
    const nonexistentChapter = {
      ...valid,
      firstSafeAppearance: { bookId: "tfe", chapter: 999_999 },
    };
    const fractionalChapter = {
      ...valid,
      firstSafeAppearance: { bookId: "tfe", chapter: 1.5 },
    };
    const negativeChapter = {
      ...valid,
      firstSafeAppearance: { bookId: "tfe", chapter: -1 },
    };

    expect(isValidKnowledgeEntry(unknownBook)).toBe(false);
    expect(isValidKnowledgeEntry(nonexistentChapter)).toBe(false);
    expect(isValidKnowledgeEntry(fractionalChapter)).toBe(false);
    expect(isValidKnowledgeEntry(negativeChapter)).toBe(false);
    expect(validatedKnowledge([valid, unknownBook, nonexistentChapter, fractionalChapter, negativeChapter]))
      .toEqual([valid]);
  });

  it("rejects entries without a usable alias", () => {
    const emptyAliases = { ...valid, aliases: [] };
    const blankAliases = { ...valid, aliases: ["   "] };
    const malformedAliases = { ...valid, aliases: [123 as unknown as string] };

    expect(isValidKnowledgeEntry(emptyAliases)).toBe(false);
    expect(isValidKnowledgeEntry(blankAliases)).toBe(false);
    expect(isValidKnowledgeEntry(malformedAliases)).toBe(false);
    expect(validatedKnowledge([valid, emptyAliases, blankAliases, malformedAliases])).toEqual([valid]);
  });

  it("rejects every member of an exact duplicate identity group", () => {
    const duplicate = withId("safe-entry", 2);
    expect(validatedKnowledge([valid, duplicate])).toEqual([]);
  });

  it("rejects NFKC-equivalent identities as a group", () => {
    const compatibilityDuplicate = withId("ｓａｆｅ－ｅｎｔｒｙ", 2);
    expect(validatedKnowledge([valid, compatibilityDuplicate])).toEqual([]);
  });

  it("rejects aliases that collide after Unicode normalization", () => {
    const duplicateAliases = {
      ...valid,
      aliases: ["Álvaro", "A\u0301lvaro"],
    };
    expect(isValidKnowledgeEntry(duplicateAliases)).toBe(false);
    expect(validatedKnowledge([duplicateAliases])).toEqual([]);
  });

  it("does not execute accessor-backed properties", () => {
    let invoked = false;
    const hostile = {
      aliases: ["Hostile"],
      kind: "concept",
      firstSafeAppearance: { bookId: "tfe", chapter: 1 },
    } as Record<string, unknown>;
    Object.defineProperty(hostile, "id", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "hostile-entry";
      },
    });

    expect(isValidKnowledgeEntry(hostile as unknown as HoidKnowledgeEntry)).toBe(false);
    expect(validatedKnowledge([hostile as unknown as HoidKnowledgeEntry])).toEqual([]);
    expect(invoked).toBe(false);
  });

  it("returns detached canonical copies rather than caller-owned objects", () => {
    const input = withId("detached-entry", 2);
    const result = validatedKnowledge([input]);
    expect(result).toHaveLength(1);

    result[0].aliases[0] = "Mutated output";
    result[0].firstSafeAppearance.chapter = 1;

    const next = validatedKnowledge([input]);
    expect(next[0].aliases).toEqual(["Alias detached-entry"]);
    expect(next[0].firstSafeAppearance.chapter).toBe(2);
    expect(input.aliases).toEqual(["Alias detached-entry"]);
    expect(input.firstSafeAppearance.chapter).toBe(2);
  });

  it("fails closed for sparse outer collections", () => {
    const sparse = new Array(2) as HoidKnowledgeEntry[];
    sparse[1] = valid;
    expect(validatedKnowledge(sparse)).toEqual([]);
  });

  it("downgrades malformed optional evidence to name-only metadata", () => {
    const malformedEvidence: HoidKnowledgeEntry = {
      ...valid,
      evidenceSource: {
        bookId: "tfe",
        chapter: 1,
        locatorId: "not-the-manifest-locator",
      },
      evidenceUnlock: { bookId: "tfe", chapter: 1 },
      summary: "Resumen editorial sintético para la prueba.",
      provenance: "verified",
    };

    expect(isValidKnowledgeEntry(malformedEvidence)).toBe(true);
    const [canonical] = validatedKnowledge([malformedEvidence]);
    expect(canonical).toBeDefined();
    expect(canonical.evidenceSource).toBeUndefined();
    expect(canonical.evidenceUnlock).toBeUndefined();
    expect(canonical.summary).toBe("Resumen editorial sintético para la prueba.");
  });
});

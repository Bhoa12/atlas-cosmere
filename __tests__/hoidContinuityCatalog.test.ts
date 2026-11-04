import {
  findEntries,
  getLockedMatches,
  isEntrySafe,
  type ContinuityEntry,
} from "../src/data/hoidContinuityCatalog";

const entries: ContinuityEntry[] = [
  {
    id: "sample-character",
    aliases: ["Nombre de prueba"],
    kind: "character",
    firstSafeAppearance: { bookId: "book-one", chapter: 3 },
  },
];

describe("hoid continuity catalog", () => {
  it("does not unlock an entry before its chapter", () => {
    expect(isEntrySafe(entries[0], { "book-one": 2 })).toBe(false);
    expect(isEntrySafe(entries[0], { "book-one": 3 })).toBe(true);
  });

  it("matches aliases without leaking unlocked status", () => {
    expect(findEntries("nombre de prueba", entries)).toHaveLength(1);
    expect(
      getLockedMatches("Nombre de prueba", entries, { "book-one": 2 }),
    ).toHaveLength(1);
  });

  it("does not unlock a position from another book", () => {
    expect(
      getLockedMatches("sample", entries, { "book-two": 99 }),
    ).toHaveLength(1);
  });
});

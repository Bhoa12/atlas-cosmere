import { DEFAULT_MAX_EDITORIAL_RECORDS, authorizedEditorialRecords, canonicalCatalog, canonicalEditorialRecord } from "./contracts";

const catalog = [{ id: "mistborn-1", title: "El Imperio Final" }, { id: "stormlight-1", title: "El Camino de los Reyes" }];

describe("editorial provenance boundary", () => {
  it("rejects records for works outside the verified catalog", () => {
    expect(canonicalEditorialRecord({ id: "x", bookId: "unknown", chapterStart: 1, chapterEnd: 1, spoilerCeiling: 1, text: "Original summary", provenance: "editorial" }, canonicalCatalog(catalog))).toBeNull();
  });

  it("does not unlock an editorial record from another work", () => {
    const records = [{ id: "storm", bookId: "stormlight-1", chapterStart: 1, chapterEnd: 1, spoilerCeiling: 1, text: "Original editorial summary", provenance: "editorial" }];
    expect(authorizedEditorialRecords(records, { "mistborn-1": 99 }, catalog)).toEqual([]);
  });

  it("requires the full spoiler ceiling and fails closed on duplicate stable record ids", () => {
    const record = { id: "safe-1", bookId: "mistborn-1", chapterStart: 1, chapterEnd: 3, spoilerCeiling: 3, text: "Original editorial summary", provenance: "editorial" };
    expect(authorizedEditorialRecords([record], { "mistborn-1": 2 }, catalog)).toEqual([]);
    expect(authorizedEditorialRecords([record, record], { "mistborn-1": 3 }, catalog)).toEqual([]);
  });

  it("rejects malformed import containers without throwing", () => {
    const valid = { id: "safe-2", bookId: "mistborn-1", chapterStart: 1, chapterEnd: 1, spoilerCeiling: 1, text: "Original editorial summary", provenance: "editorial" };
    expect(authorizedEditorialRecords(null as unknown as readonly unknown[], { "mistborn-1": 1 }, catalog)).toEqual([]);
    expect(authorizedEditorialRecords({ 0: valid, length: 1 } as unknown as readonly unknown[], { "mistborn-1": 1 }, catalog)).toEqual([]);
  });

  it("returns an empty result for non-array catalogs", () => {
    const record = { id: "safe-3", bookId: "mistborn-1", chapterStart: 1, chapterEnd: 1, spoilerCeiling: 1, text: "Original editorial summary", provenance: "editorial" };
    expect(authorizedEditorialRecords([record], { "mistborn-1": 1 }, null as unknown as typeof catalog)).toEqual([]);
  });

  it("still accepts a valid bounded import", () => {
    const record = { id: "safe-4", bookId: "mistborn-1", chapterStart: 1, chapterEnd: 1, spoilerCeiling: 1, text: "Original editorial summary", provenance: "editorial" };
    expect(authorizedEditorialRecords([record], { "mistborn-1": 1 }, catalog).map((item) => item.id)).toEqual(["safe-4"]);
  });
});

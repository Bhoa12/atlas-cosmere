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
});

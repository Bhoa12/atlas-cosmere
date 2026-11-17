import { describe, expect, it } from "vitest";
import {
  getVerifiedChapterDocumentCount,
  getVerifiedChapterDocumentSha256,
} from "./verifiedChapterDocuments";

describe("verified EPUB chapter document fingerprints", () => {
  it("returns the exact inspected chapter-one digest for each available Roshar work", () => {
    expect(getVerifiedChapterDocumentSha256(
      "twok",
      "roshar-omnibus-v1",
      "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      1,
    )).toBe("0853a9469afe233d415645208f04bafb7f5dd5d603af9706c8924bcf14d27a70");

    expect(getVerifiedChapterDocumentSha256(
      "edgedancer",
      "edgedancer-epub-v1",
      "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      1,
    )).toBe("8a85e1ccb126c5915f3948351266030b0966abb822403ddd0415791c671ce7dc");

    expect(getVerifiedChapterDocumentSha256(
      "dawnshard",
      "dawnshard-epub-v1",
      "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
      1,
    )).toBe("eac1f947b3303414b0b8a69ff19eabcd396c1fdd32caa1c1349c931eb8d8d2ae");
  });

  it("rejects a digest lookup from another edition or navigation document", () => {
    expect(getVerifiedChapterDocumentSha256(
      "twok",
      "edgedancer-epub-v1",
      "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
      1,
    )).toBeNull();
  });

  it("does not invent fingerprints for chapters that were not inspected", () => {
    expect(getVerifiedChapterDocumentSha256(
      "twok",
      "roshar-omnibus-v1",
      "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      2,
    )).toBeNull();
    expect(getVerifiedChapterDocumentCount("twok")).toBe(1);
    expect(getVerifiedChapterDocumentCount("unknown-work")).toBe(0);
  });

  it("rejects malformed input", () => {
    expect(getVerifiedChapterDocumentSha256(null, "roshar-omnibus-v1", "0".repeat(64), 1)).toBeNull();
    expect(getVerifiedChapterDocumentSha256("twok", "roshar-omnibus-v1", "bad", 1)).toBeNull();
    expect(getVerifiedChapterDocumentSha256("twok", "roshar-omnibus-v1", "0".repeat(64), 0)).toBeNull();
  });
});

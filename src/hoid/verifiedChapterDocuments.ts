import { getVerifiedChapterLocatorId } from "./verifiedChapterLocators";

type VerifiedChapterDocumentSource = Readonly<{
  editionId: string;
  navigationSha256: string;
  documents: Readonly<Record<number, string>>;
}>;

/**
 * SHA-256 fingerprints of individual XHTML chapter documents inspected
 * directly from the private EPUBs. This is a deliberately sparse allowlist:
 * only chapters whose bytes were actually inspected appear here.
 *
 * No chapter text, title or extracted passage is stored.
 */
const VERIFIED: Readonly<Record<string, VerifiedChapterDocumentSource>> = Object.freeze({
  twok: Object.freeze({
    editionId: "roshar-omnibus-v1",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    documents: Object.freeze({
      1: "0853a9469afe233d415645208f04bafb7f5dd5d603af9706c8924bcf14d27a70",
      2: "5f76bd1de8106ebcba964f730368426fc22df1c2a7862e4f01dcf57ec0f63877",
      3: "aad893dde20e24a5444100d260f4d466f6ef553a13d676457d6f42015d774a0e",
    }),
  }),
  edgedancer: Object.freeze({
    editionId: "edgedancer-epub-v1",
    navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
    documents: Object.freeze({
      1: "8a85e1ccb126c5915f3948351266030b0966abb822403ddd0415791c671ce7dc",
      2: "397c116112ca87b77cdd2c324156349594f47660d332a10417884119c8e7b0a0",
      3: "2a82686dd7fa7908d4b175f9b03f165309e08ccbb2294c6bcd32443b6d0d3905",
    }),
  }),
  dawnshard: Object.freeze({
    editionId: "dawnshard-epub-v1",
    navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
    documents: Object.freeze({
      1: "eac1f947b3303414b0b8a69ff19eabcd396c1fdd32caa1c1349c931eb8d8d2ae",
      2: "511dd868f3feb65f3cc28566bbac167762ad70dddccffcae863be31e64f144dc",
      3: "709bca2ea215db4e90fc654b4b503a7c71d96bb40a508d5347ec83006b8cc286",
    }),
  }),
  tfe: Object.freeze({
    editionId: "cosmere-epub-merged-v1",
    navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
    documents: Object.freeze({
      1: "cfc6a6057a477cfba6e7795d30dca2324a97a5dbdefa86b6500aa437a625844a",
      2: "13604dc85df709443e6cd215a3e1a9deabe8f69f118dcc9823127b82ad486fc1",
    }),
  }),
});

/**
 * Return a chapter-document digest only when both the edition-bound navigation
 * locator and the exact source-document digest were verified offline.
 */
export function getVerifiedChapterDocumentSha256(
  bookId: unknown,
  editionId: unknown,
  navigationSha256: unknown,
  chapterNumber: unknown,
): string | null {
  if (
    typeof bookId !== "string" ||
    typeof editionId !== "string" ||
    typeof navigationSha256 !== "string" ||
    typeof chapterNumber !== "number" ||
    !Number.isSafeInteger(chapterNumber) ||
    chapterNumber < 1
  ) return null;

  if (!Object.prototype.hasOwnProperty.call(VERIFIED, bookId)) return null;
  const source = VERIFIED[bookId];
  if (
    source.editionId !== editionId ||
    source.navigationSha256 !== navigationSha256 ||
    getVerifiedChapterLocatorId(bookId, editionId, navigationSha256, chapterNumber) === null
  ) return null;

  const digest = source.documents[chapterNumber];
  return typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)
    ? digest
    : null;
}

/** Number of individually inspected chapter documents for one work. */
export function getVerifiedChapterDocumentCount(bookId: unknown): number {
  if (typeof bookId !== "string" || !Object.prototype.hasOwnProperty.call(VERIFIED, bookId)) return 0;
  return Object.keys(VERIFIED[bookId].documents).length;
}

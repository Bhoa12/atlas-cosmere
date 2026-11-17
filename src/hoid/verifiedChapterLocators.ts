/**
 * Exact chapter-to-navigation locators derived from inspected private EPUB TOCs.
 *
 * Only relative navigation hrefs are stored. Chapter titles, body text and
 * extracted passages are deliberately excluded. Every locator is bound to the
 * edition ID and SHA-256 of that edition's navigation document.
 *
 * The cosmere.epub navigation was inspected in Run 106. This verifies chapter
 * structure and relative hrefs only; it does not claim that chapter bodies
 * were read or that narrative evidence was reviewed. Ambiguous and collection
 * works remain conservative.
 */
type RawNavigationSource = Readonly<{
  editionId: string;
  navigationSha256: string;
  chapterHrefs: string;
}>;

type VerifiedNavigationSource = Readonly<{
  editionId: string;
  navigationSha256: string;
  chapterHrefs: readonly string[];
}>;

const RAW: Readonly<Record<string, RawNavigationSource>> = Object.freeze({
  twok: {
    editionId: "roshar-omnibus-v1",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    chapterHrefs: "L1-012.xhtml,L1-013.xhtml,L1-015.xhtml,L1-016.xhtml,L1-017.xhtml,L1-019.xhtml,L1-020.xhtml,L1-021.xhtml,L1-023.xhtml,L1-024.xhtml,L1-025.xhtml,L1-032.xhtml,L1-033.xhtml,L1-034.xhtml,L1-035.xhtml,L1-037.xhtml,L1-038.xhtml,L1-040.xhtml,L1-041.xhtml,L1-042.xhtml,L1-043.xhtml,L1-044.xhtml,L1-045.xhtml,L1-047.xhtml,L1-048.xhtml,L1-049.xhtml,L1-050.xhtml,L1-051.xhtml,L1-058.xhtml,L1-059.xhtml,L1-060.xhtml,L1-061.xhtml,L1-063.xhtml,L1-064.xhtml,L1-065.xhtml,L1-066.xhtml,L1-068.xhtml,L1-069.xhtml,L1-070.xhtml,L1-071.xhtml,L1-073.xhtml,L1-074.xhtml,L1-075.xhtml,L1-077.xhtml,L1-078.xhtml,L1-079.xhtml,L1-080.xhtml,L1-081.xhtml,L1-083.xhtml,L1-084.xhtml,L1-085.xhtml,L1-091.xhtml,L1-092.xhtml,L1-093.xhtml,L1-095.xhtml,L1-096.xhtml,L1-098.xhtml,L1-099.xhtml,L1-100.xhtml,L1-101.xhtml,L1-103.xhtml,L1-104.xhtml,L1-105.xhtml,L1-106.xhtml,L1-108.xhtml,L1-109.xhtml,L1-110.xhtml,L1-111.xhtml,L1-113.xhtml,L1-115.xhtml,L1-116.xhtml,L1-117.xhtml,L1-118.xhtml,L1-119.xhtml,L1-120.xhtml",
  },
  wor: {
    editionId: "roshar-omnibus-v1",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    chapterHrefs: "L2-010.xhtml,L2-011.xhtml,L2-013.xhtml,L2-014.xhtml,L2-016.xhtml,L2-017.xhtml,L2-018.xhtml,L2-019.xhtml,L2-020.xhtml,L2-021.xhtml,L2-023.xhtml,L2-024.xhtml,L2-031.xhtml,L2-033.xhtml,L2-034.xhtml,L2-035.xhtml,L2-037.xhtml,L2-038.xhtml,L2-039.xhtml,L2-040.xhtml,L2-041.xhtml,L2-043.xhtml,L2-044.xhtml,L2-045.xhtml,L2-046.xhtml,L2-047.xhtml,L2-048.xhtml,L2-049.xhtml,L2-050.xhtml,L2-052.xhtml,L2-053.xhtml,L2-054.xhtml,L2-055.xhtml,L2-056.xhtml,L2-064.xhtml,L2-065.xhtml,L2-066.xhtml,L2-067.xhtml,L2-068.xhtml,L2-069.xhtml,L2-070.xhtml,L2-071.xhtml,L2-072.xhtml,L2-073.xhtml,L2-075.xhtml,L2-076.xhtml,L2-077.xhtml,L2-078.xhtml,L2-080.xhtml,L2-081.xhtml,L2-082.xhtml,L2-083.xhtml,L2-084.xhtml,L2-086.xhtml,L2-087.xhtml,L2-088.xhtml,L2-089.xhtml,L2-090.xhtml,L2-096.xhtml,L2-098.xhtml,L2-099.xhtml,L2-100.xhtml,L2-101.xhtml,L2-102.xhtml,L2-104.xhtml,L2-105.xhtml,L2-106.xhtml,L2-107.xhtml,L2-108.xhtml,L2-110.xhtml,L2-111.xhtml,L2-112.xhtml,L2-113.xhtml,L2-114.xhtml,L2-116.xhtml,L2-122.xhtml,L2-124.xhtml,L2-125.xhtml,L2-126.xhtml,L2-128.xhtml,L2-129.xhtml,L2-130.xhtml,L2-132.xhtml,L2-133.xhtml,L2-134.xhtml,L2-135.xhtml,L2-136.xhtml,L2-137.xhtml,L2-138.xhtml",
  },
  ob: {
    editionId: "roshar-omnibus-v1",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    chapterHrefs: "L3-012.xhtml,L3-013.xhtml,L3-014.xhtml,L3-015.xhtml,L3-017.xhtml,L3-018.xhtml,L3-019.xhtml,L3-021.xhtml,L3-022.xhtml,L3-023.xhtml,L3-024.xhtml,L3-025.xhtml,L3-026.xhtml,L3-027.xhtml,L3-029.xhtml,L3-030.xhtml,L3-031.xhtml,L3-032.xhtml,L3-033.xhtml,L3-034.xhtml,L3-035.xhtml,L3-036.xhtml,L3-037.xhtml,L3-038.xhtml,L3-040.xhtml,L3-041.xhtml,L3-043.xhtml,L3-044.xhtml,L3-045.xhtml,L3-046.xhtml,L3-047.xhtml,L3-048.xhtml,L3-055.xhtml,L3-056.xhtml,L3-057.xhtml,L3-058.xhtml,L3-059.xhtml,L3-060.xhtml,L3-062.xhtml,L3-063.xhtml,L3-064.xhtml,L3-065.xhtml,L3-066.xhtml,L3-068.xhtml,L3-069.xhtml,L3-070.xhtml,L3-071.xhtml,L3-072.xhtml,L3-073.xhtml,L3-074.xhtml,L3-075.xhtml,L3-076.xhtml,L3-078.xhtml,L3-079.xhtml,L3-080.xhtml,L3-081.xhtml,L3-082.xhtml,L3-089.xhtml,L3-090.xhtml,L3-091.xhtml,L3-093.xhtml,L3-094.xhtml,L3-095.xhtml,L3-096.xhtml,L3-097.xhtml,L3-098.xhtml,L3-100.xhtml,L3-101.xhtml,L3-102.xhtml,L3-103.xhtml,L3-104.xhtml,L3-105.xhtml,L3-106.xhtml,L3-107.xhtml,L3-108.xhtml,L3-109.xhtml,L3-111.xhtml,L3-112.xhtml,L3-113.xhtml,L3-114.xhtml,L3-115.xhtml,L3-116.xhtml,L3-117.xhtml,L3-118.xhtml,L3-119.xhtml,L3-120.xhtml,L3-121.xhtml,L3-129.xhtml,L3-131.xhtml,L3-132.xhtml,L3-133.xhtml,L3-134.xhtml,L3-135.xhtml,L3-137.xhtml,L3-138.xhtml,L3-139.xhtml,L3-140.xhtml,L3-141.xhtml,L3-143.xhtml,L3-144.xhtml,L3-145.xhtml,L3-146.xhtml,L3-147.xhtml,L3-149.xhtml,L3-150.xhtml,L3-151.xhtml,L3-152.xhtml,L3-154.xhtml,L3-155.xhtml,L3-156.xhtml,L3-157.xhtml,L3-158.xhtml,L3-159.xhtml,L3-165.xhtml,L3-166.xhtml,L3-168.xhtml,L3-169.xhtml,L3-170.xhtml,L3-171.xhtml,L3-173.xhtml,L3-174.xhtml,L3-175.xhtml",
  },
  row: {
    editionId: "roshar-omnibus-v1",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    chapterHrefs: "L4-012.xhtml,L4-013.xhtml,L4-015.xhtml,L4-016.xhtml,L4-017.xhtml,L4-019.xhtml,L4-020.xhtml,L4-021.xhtml,L4-022.xhtml,L4-023.xhtml,L4-025.xhtml,L4-026.xhtml,L4-027.xhtml,L4-028.xhtml,L4-029.xhtml,L4-030.xhtml,L4-031.xhtml,L4-032.xhtml,L4-033.xhtml,L4-040.xhtml,L4-041.xhtml,L4-043.xhtml,L4-044.xhtml,L4-046.xhtml,L4-047.xhtml,L4-048.xhtml,L4-049.xhtml,L4-050.xhtml,L4-052.xhtml,L4-053.xhtml,L4-054.xhtml,L4-055.xhtml,L4-056.xhtml,L4-057.xhtml,L4-058.xhtml,L4-060.xhtml,L4-061.xhtml,L4-062.xhtml,L4-063.xhtml,L4-064.xhtml,L4-066.xhtml,L4-067.xhtml,L4-068.xhtml,L4-075.xhtml,L4-076.xhtml,L4-077.xhtml,L4-079.xhtml,L4-080.xhtml,L4-081.xhtml,L4-082.xhtml,L4-083.xhtml,L4-084.xhtml,L4-086.xhtml,L4-087.xhtml,L4-088.xhtml,L4-089.xhtml,L4-090.xhtml,L4-091.xhtml,L4-092.xhtml,L4-093.xhtml,L4-095.xhtml,L4-096.xhtml,L4-097.xhtml,L4-098.xhtml,L4-099.xhtml,L4-100.xhtml,L4-101.xhtml,L4-102.xhtml,L4-103.xhtml,L4-104.xhtml,L4-105.xhtml,L4-106.xhtml,L4-114.xhtml,L4-115.xhtml,L4-117.xhtml,L4-118.xhtml,L4-119.xhtml,L4-121.xhtml,L4-122.xhtml,L4-123.xhtml,L4-124.xhtml,L4-125.xhtml,L4-126.xhtml,L4-128.xhtml,L4-129.xhtml,L4-130.xhtml,L4-131.xhtml,L4-132.xhtml,L4-133.xhtml,L4-134.xhtml,L4-135.xhtml,L4-136.xhtml,L4-137.xhtml,L4-138.xhtml,L4-139.xhtml,L4-140.xhtml,L4-142.xhtml,L4-148.xhtml,L4-149.xhtml,L4-150.xhtml,L4-151.xhtml,L4-152.xhtml,L4-153.xhtml,L4-154.xhtml,L4-155.xhtml,L4-156.xhtml,L4-157.xhtml,L4-158.xhtml,L4-159.xhtml,L4-160.xhtml,L4-161.xhtml,L4-162.xhtml,L4-163.xhtml,L4-164.xhtml,L4-165.xhtml,L4-166.xhtml,L4-167.xhtml",
  },
  sawt: {
    editionId: "roshar-omnibus-v1",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    chapterHrefs: "L5-011.xhtml,L5-012.xhtml,L5-013.xhtml,L5-014.xhtml,L5-015.xhtml,L5-016.xhtml,L5-017.xhtml,L5-018.xhtml,L5-019.xhtml,L5-020.xhtml,L5-021.xhtml",
  },
  edgedancer: {
    editionId: "edgedancer-epub-v1",
    navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
    chapterHrefs: "Text/001.xhtml,Text/002.xhtml,Text/003.xhtml,Text/004.xhtml,Text/005.xhtml,Text/006.xhtml,Text/007.xhtml,Text/008.xhtml,Text/009.xhtml,Text/010.xhtml,Text/011.xhtml,Text/012.xhtml,Text/013.xhtml,Text/014.xhtml,Text/015.xhtml,Text/016.xhtml,Text/017.xhtml,Text/018.xhtml,Text/019.xhtml,Text/020.xhtml",
  },
  dawnshard: {
    editionId: "dawnshard-epub-v1",
    navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
    chapterHrefs: "Text/1.xhtml,Text/2.xhtml,Text/3.xhtml,Text/4.xhtml,Text/5.xhtml,Text/6.xhtml,Text/7.xhtml,Text/8.xhtml,Text/9.xhtml,Text/10.xhtml,Text/11.xhtml,Text/12.xhtml,Text/13.xhtml,Text/14.xhtml,Text/15.xhtml,Text/16.xhtml,Text/17.xhtml,Text/18.xhtml,Text/19.xhtml",
  },
});


const COSMERE_EDITION_ID = "cosmere-epub-merged-v1";
const COSMERE_NAVIGATION_SHA256 = "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee";

type ChapterHrefRange = Readonly<{
  from: number;
  to: number;
  prefix: string;
  padding: number;
  suffix?: string;
}>;

function buildCosmereChapterHrefs(
  bookNumber: number,
  ranges: readonly ChapterHrefRange[],
): readonly string[] {
  const root = `books/b${String(bookNumber).padStart(6, "0")}/OEBPS/Text/`;
  return Object.freeze(ranges.flatMap(range =>
    Array.from({ length: range.to - range.from + 1 }, (_, index) => {
      const chapterNumber = range.from + index;
      return root +
        range.prefix +
        String(chapterNumber).padStart(range.padding, "0") +
        (range.suffix ?? ".xhtml");
    }),
  ));
}

function buildCosmereSource(chapterHrefs: readonly string[]): RawNavigationSource {
  return Object.freeze({
    editionId: COSMERE_EDITION_ID,
    navigationSha256: COSMERE_NAVIGATION_SHA256,
    chapterHrefs: chapterHrefs.join(","),
  });
}

/**
 * Numbered chapter hrefs from EPUB/nav.xhtml, ordered by chapter number.
 * Elantris is intentionally capped at chapter 47 before duplicate numbers.
 * White Sand and Arcanum are not assigned synthetic global chapter sequences.
 */
const COSMERE_RAW: Readonly<Record<string, RawNavigationSource>> = Object.freeze({
  tfe: buildCosmereSource(buildCosmereChapterHrefs(1, [
    { from: 1, to: 38, prefix: "", padding: 3 },
  ])),
  woa: buildCosmereSource(buildCosmereChapterHrefs(2, [
    { from: 1, to: 59, prefix: "", padding: 3 },
  ])),
  hoa: buildCosmereSource(buildCosmereChapterHrefs(3, [
    { from: 1, to: 13, prefix: "P1-", padding: 2 },
    { from: 14, to: 33, prefix: "P2-", padding: 2 },
    { from: 34, to: 44, prefix: "P3-", padding: 2 },
    { from: 45, to: 58, prefix: "P4-", padding: 2 },
    { from: 59, to: 82, prefix: "P5-", padding: 2 },
  ])),
  aol: buildCosmereSource(buildCosmereChapterHrefs(4, [
    { from: 1, to: 6, prefix: "P1-", padding: 2 },
    { from: 7, to: 15, prefix: "P2-", padding: 2 },
    { from: 16, to: 20, prefix: "P3-", padding: 2 },
  ])),
  sos: buildCosmereSource(buildCosmereChapterHrefs(5, [
    { from: 1, to: 4, prefix: "P1-", padding: 2 },
    { from: 5, to: 21, prefix: "P2-", padding: 2 },
    { from: 22, to: 26, prefix: "P3-", padding: 2 },
  ])),
  bom: buildCosmereSource(buildCosmereChapterHrefs(6, [
    { from: 1, to: 4, prefix: "P1-", padding: 2 },
    { from: 5, to: 16, prefix: "P2-", padding: 2 },
    { from: 17, to: 31, prefix: "P3-", padding: 2 },
  ])),
  tlm: buildCosmereSource(Object.freeze([
    14, 15, 17, 18, 19, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    36, 37, 38, 39, 43, 44, 45, 46, 47, 48, 49, 50, 52, 55, 56,
    57, 58, 59, 60, 62, 63, 64, 65, 66, 67, 71, 72, 73, 75, 76,
    77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 92, 93,
    94, 95, 96, 97, 98, 102, 103, 104, 105, 106, 107, 110, 111, 112,
  ].map(partNumber =>
    `books/b000007/OEBPS/Text/part${String(partNumber).padStart(4, "0")}.html`,
  ))),
  warbreaker: buildCosmereSource(buildCosmereChapterHrefs(8, [
    { from: 1, to: 58, prefix: "", padding: 3 },
  ])),
  elantris: buildCosmereSource(buildCosmereChapterHrefs(9, [
    { from: 1, to: 27, prefix: "001_", padding: 3 },
    { from: 28, to: 47, prefix: "002_", padding: 3 },
  ])),
  tress: buildCosmereSource(buildCosmereChapterHrefs(11, [
    { from: 1, to: 5, prefix: "P1-", padding: 2 },
    { from: 6, to: 12, prefix: "P2-", padding: 2 },
    { from: 13, to: 21, prefix: "P3-", padding: 2 },
    { from: 22, to: 34, prefix: "P4-", padding: 2 },
    { from: 35, to: 53, prefix: "P5-", padding: 2 },
    { from: 54, to: 64, prefix: "P6-", padding: 2 },
  ])),
  yumi: buildCosmereSource(buildCosmereChapterHrefs(12, [
    { from: 1, to: 7, prefix: "P1-", padding: 2 },
    { from: 8, to: 17, prefix: "P2-", padding: 2 },
    { from: 18, to: 30, prefix: "P3-", padding: 2 },
    { from: 31, to: 41, prefix: "P4-", padding: 2 },
  ])),
  sunlit: buildCosmereSource(buildCosmereChapterHrefs(13, [
    { from: 1, to: 52, prefix: "Capitulo-", padding: 2 },
  ])),
  isles: buildCosmereSource(buildCosmereChapterHrefs(14, [
    { from: 1, to: 21, prefix: "Libro1-", padding: 2 },
    { from: 22, to: 33, prefix: "Libro2-", padding: 2 },
    { from: 34, to: 53, prefix: "Libro3-", padding: 2 },
    { from: 54, to: 61, prefix: "Libro4-", padding: 2 },
  ])),
});

const VERIFIED: Readonly<Record<string, VerifiedNavigationSource>> = Object.freeze(
  Object.fromEntries(Object.entries({ ...RAW, ...COSMERE_RAW }).map(([bookId, source]) => {
    const hrefs = source.chapterHrefs.split(",");
    if (
      !/^[a-z0-9-]{3,96}$/.test(source.editionId) ||
      !/^[a-f0-9]{64}$/.test(source.navigationSha256) ||
      hrefs.length === 0 ||
      new Set(hrefs).size !== hrefs.length ||
      !hrefs.every(href => /^(?:(?:L[1-5]-[0-9]{3}|Text[/][0-9]{1,3})[.]xhtml|books[/]b[0-9]{6}[/]OEBPS[/]Text[/][A-Za-z0-9._-]+[.](?:xhtml|html))$/.test(href) && !href.includes(".."))
    ) {
      throw new Error("Invalid verified Hoid chapter navigation metadata");
    }
    return [bookId, Object.freeze({
      editionId: source.editionId,
      navigationSha256: source.navigationSha256,
      chapterHrefs: Object.freeze(hrefs),
    })];
  })),
);

/**
 * Return a stable, edition-bound locator for one numbered chapter.
 * The underlying EPUB href is metadata only; it is namespaced by the exact
 * edition and navigation digest so it cannot be reused across editions.
 */
export function getVerifiedChapterLocatorId(
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
    !source ||
    source.editionId !== editionId ||
    source.navigationSha256 !== navigationSha256
  ) return null;

  const href = source.chapterHrefs[chapterNumber - 1];
  return href
    ? `nav:${source.editionId}:${source.navigationSha256}:${href}`
    : null;
}

/** Number of chapter locators verified for a work in its exact source edition. */
export function getVerifiedChapterLocatorCount(bookId: unknown): number {
  if (typeof bookId !== "string") return 0;
  return Object.prototype.hasOwnProperty.call(VERIFIED, bookId)
    ? VERIFIED[bookId].chapterHrefs.length
    : 0;
}

import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";

export type HoidEditionSourceGroup = "cosmere.epub" | "roshar-epubs";

export type HoidEditionWorkStructure = Readonly<{
  /** One ID for a normal work; several IDs only when the EPUB merges volumes. */
  workIds: readonly string[];
  mode:
    | "numeric-chapters"
    | "chapter-number-with-duplicate-locators"
    | "requires-volume-segmentation"
    | "collection-sections";
  /** Number of distinct numbered chapter values in this exact edition's TOC. */
  chapterCount?: number;
  /** Repeated chapter numbers whose TOC locators are distinct. */
  duplicateChapterNumbers?: readonly number[];
}>;

export type HoidEditionStructureSource = Readonly<{
  editionId: string;
  sourceGroup: HoidEditionSourceGroup;
  /** SHA-256 of the EPUB navigation document only; no prose is stored. */
  navigationSha256: string;
  works: readonly HoidEditionWorkStructure[];
}>;

const RAW_EDITION_STRUCTURES: readonly HoidEditionStructureSource[] = [
  {
    editionId: "cosmere-epub-merged-v1",
    sourceGroup: "cosmere.epub",
    navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
    works: [
      { workIds: ["tfe"], mode: "numeric-chapters", chapterCount: 38 },
      { workIds: ["woa"], mode: "numeric-chapters", chapterCount: 59 },
      { workIds: ["hoa"], mode: "numeric-chapters", chapterCount: 82 },
      { workIds: ["aol"], mode: "numeric-chapters", chapterCount: 20 },
      { workIds: ["sos"], mode: "numeric-chapters", chapterCount: 26 },
      { workIds: ["bom"], mode: "numeric-chapters", chapterCount: 31 },
      { workIds: ["tlm"], mode: "numeric-chapters", chapterCount: 74 },
      { workIds: ["warbreaker"], mode: "numeric-chapters", chapterCount: 58 },
      {
        workIds: ["elantris"],
        mode: "chapter-number-with-duplicate-locators",
        chapterCount: 63,
        duplicateChapterNumbers: [48, 51, 57],
      },
      {
        workIds: ["white-sand-1", "white-sand-2", "white-sand-3"],
        mode: "requires-volume-segmentation",
      },
      { workIds: ["tress"], mode: "numeric-chapters", chapterCount: 64 },
      { workIds: ["yumi"], mode: "numeric-chapters", chapterCount: 41 },
      { workIds: ["sunlit"], mode: "numeric-chapters", chapterCount: 52 },
      { workIds: ["isles"], mode: "numeric-chapters", chapterCount: 61 },
      { workIds: ["arcanum"], mode: "collection-sections" },
    ],
  },
  {
    editionId: "roshar-omnibus-v1",
    sourceGroup: "roshar-epubs",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    works: [
      { workIds: ["twok"], mode: "numeric-chapters", chapterCount: 75 },
      { workIds: ["wor"], mode: "numeric-chapters", chapterCount: 89 },
      { workIds: ["ob"], mode: "numeric-chapters", chapterCount: 122 },
      { workIds: ["row"], mode: "numeric-chapters", chapterCount: 117 },
      {
        workIds: ["sawt"],
        mode: "chapter-number-with-duplicate-locators",
        chapterCount: 147,
        duplicateChapterNumbers: [12, 14],
      },
    ],
  },
  {
    editionId: "edgedancer-epub-v1",
    sourceGroup: "roshar-epubs",
    navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
    works: [{ workIds: ["edgedancer"], mode: "numeric-chapters", chapterCount: 20 }],
  },
  {
    editionId: "dawnshard-epub-v1",
    sourceGroup: "roshar-epubs",
    navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
    works: [{ workIds: ["dawnshard"], mode: "numeric-chapters", chapterCount: 19 }],
  },
];

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * Validate that edition structure covers the declared bibliography exactly
 * once. Chapter counts are accepted only for contiguous numeric chapter
 * sequences; collections and merged volumes must use a more precise cursor.
 */
export function validateHoidEditionStructures(
  sources: readonly HoidEditionStructureSource[],
): readonly HoidEditionStructureSource[] {
  const knownWorks = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.sourceGroup]));
  const editionIds = new Set<string>();
  const assignedWorks = new Set<string>();
  const validated: HoidEditionStructureSource[] = [];

  for (const source of sources) {
    if (!source || typeof source.editionId !== "string" || !/^[a-z0-9-]{3,96}$/.test(source.editionId)) {
      throw new Error("Invalid Hoid edition identifier");
    }
    if (editionIds.has(source.editionId)) throw new Error("Duplicate Hoid edition identifier");
    if (source.sourceGroup !== "cosmere.epub" && source.sourceGroup !== "roshar-epubs") {
      throw new Error("Unknown Hoid edition source group");
    }
    if (typeof source.navigationSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.navigationSha256)) {
      throw new Error("Invalid Hoid navigation digest");
    }
    if (!Array.isArray(source.works) || source.works.length === 0) {
      throw new Error("Hoid edition must contain at least one work structure");
    }

    editionIds.add(source.editionId);
    const works: HoidEditionWorkStructure[] = [];

    for (const work of source.works) {
      if (!work || !Array.isArray(work.workIds) || work.workIds.length === 0) {
        throw new Error("Hoid edition work IDs are required");
      }
      const ids = [...work.workIds];
      if (new Set(ids).size !== ids.length) throw new Error("Duplicate work ID inside edition structure");

      for (const id of ids) {
        const knownGroup = knownWorks.get(id);
        if (!knownGroup || knownGroup !== source.sourceGroup) {
          throw new Error("Edition structure references an unknown or mismatched bibliography work");
        }
        if (assignedWorks.has(id)) throw new Error("Bibliography work is assigned more than once");
        assignedWorks.add(id);
      }

      const duplicates = work.duplicateChapterNumbers;
      if (work.mode === "numeric-chapters") {
        if (!isPositiveInteger(work.chapterCount) || (duplicates !== undefined && duplicates.length > 0)) {
          throw new Error("Numeric chapter structure is incomplete or ambiguous");
        }
      } else if (work.mode === "chapter-number-with-duplicate-locators") {
        if (!isPositiveInteger(work.chapterCount) || !Array.isArray(duplicates) || duplicates.length === 0) {
          throw new Error("Duplicate-locator structure requires chapter count and duplicate numbers");
        }
        const seen = new Set<number>();
        for (const number of duplicates) {
          if (!isPositiveInteger(number) || number > work.chapterCount || seen.has(number)) {
            throw new Error("Invalid duplicate chapter number");
          }
          seen.add(number);
        }
      } else if (work.mode === "requires-volume-segmentation") {
        if (ids.length < 2 || work.chapterCount !== undefined || duplicates !== undefined) {
          throw new Error("Merged-volume structure must remain unsegmented");
        }
      } else if (work.mode === "collection-sections") {
        if (ids.length !== 1 || work.chapterCount !== undefined || duplicates !== undefined) {
          throw new Error("Collection structure cannot expose a global chapter count");
        }
      } else {
        throw new Error("Unknown Hoid edition progress mode");
      }

      works.push(Object.freeze({
        workIds: Object.freeze(ids),
        mode: work.mode,
        ...(work.chapterCount === undefined ? {} : { chapterCount: work.chapterCount }),
        ...(duplicates === undefined ? {} : { duplicateChapterNumbers: Object.freeze([...duplicates].sort((a, b) => a - b)) }),
      }));
    }

    validated.push(Object.freeze({
      editionId: source.editionId,
      sourceGroup: source.sourceGroup,
      navigationSha256: source.navigationSha256,
      works: Object.freeze(works),
    }));
  }

  if (assignedWorks.size !== knownWorks.size) {
    throw new Error("Hoid edition structures do not cover the full source bibliography");
  }

  return Object.freeze(validated);
}

export const HOID_EDITION_STRUCTURES = validateHoidEditionStructures(RAW_EDITION_STRUCTURES);

export type HoidEditionProgressPolicy =
  | Readonly<{ kind: "numeric-chapters"; editionId: string; chapterCount: number }>
  | Readonly<{
      kind: "chapter-number-with-duplicate-locators";
      editionId: string;
      chapterCount: number;
      safeNumericProgressThroughChapter: number;
      duplicateChapterNumbers: readonly number[];
    }>
  | Readonly<{ kind: "requires-volume-segmentation"; editionId: string }>
  | Readonly<{ kind: "collection-sections"; editionId: string }>
  | Readonly<{ kind: "unknown" }>;

/**
 * Return the safest progress representation for a bibliography work.
 * Numeric-only progress is deliberately capped before the first duplicate
 * chapter number when the EPUB has distinct locators with the same number.
 */
export function getHoidEditionProgressPolicy(bookId: string): HoidEditionProgressPolicy {
  if (typeof bookId !== "string" || !bookId.trim()) return Object.freeze({ kind: "unknown" as const });

  for (const source of HOID_EDITION_STRUCTURES) {
    for (const work of source.works) {
      if (!work.workIds.includes(bookId)) continue;
      if (work.mode === "numeric-chapters") {
        return Object.freeze({ kind: work.mode, editionId: source.editionId, chapterCount: work.chapterCount! });
      }
      if (work.mode === "chapter-number-with-duplicate-locators") {
        const firstAmbiguous = Math.min(...work.duplicateChapterNumbers!);
        return Object.freeze({
          kind: work.mode,
          editionId: source.editionId,
          chapterCount: work.chapterCount!,
          safeNumericProgressThroughChapter: firstAmbiguous - 1,
          duplicateChapterNumbers: work.duplicateChapterNumbers!,
        });
      }
      return Object.freeze({ kind: work.mode, editionId: source.editionId });
    }
  }

  return Object.freeze({ kind: "unknown" as const });
}

import { describe, expect, it } from "vitest";
import { HOID_EDITION_STRUCTURES } from "./editionStructure";
import type { HoidEpubProbeEntry, HoidEpubStructureProbe } from "./epubSourceProbe";
import {
  getHoidEpubWorkSegmentationManifest,
  getHoidSegmentedNavigationEntry,
  HOID_EPUB_WORK_SEGMENTATION_MANIFESTS,
  validateHoidEpubWorkSegmentation,
} from "./epubWorkSegmentation";

function buildProbe(editionId: string): HoidEpubStructureProbe {
  const manifest = getHoidEpubWorkSegmentationManifest(editionId);
  if (!manifest) throw new Error("Missing test segmentation manifest");
  const edition = HOID_EDITION_STRUCTURES.find(item => item.editionId === editionId);
  if (!edition) throw new Error("Missing test edition structure");

  const entries: HoidEpubProbeEntry[] = new Array(manifest.navigationEntryCount);
  const allNumbers: number[] = [];
  let numberedEntryOrdinal = 0;

  for (const segment of manifest.segments) {
    const work = edition.works.find(item => item.workIds.includes(segment.workId));
    if (!work || !work.chapterCount) throw new Error("Unsupported test work structure");
    const chapterNumbers = Array.from({ length: work.chapterCount }, (_, index) => index + 1);
    if (work.mode === "chapter-number-with-duplicate-locators") {
      chapterNumbers.push(...(work.duplicateChapterNumbers ?? []));
    }

    const tocCount = segment.tocEntryCount;
    const spineCount = segment.spineOrdinalEnd - segment.spineOrdinalStart + 1;
    for (let offset = 0; offset < tocCount; offset += 1) {
      const tocOrdinal = segment.tocOrdinalStart + offset;
      const spineOrdinal = segment.spineOrdinalStart + Math.floor(offset * spineCount / tocCount);
      const locatorId = "nav:" + tocOrdinal.toString(16).padStart(32, "0");
      if (offset < segment.numberedEntryCount) {
        const chapterNumber = chapterNumbers[offset];
        numberedEntryOrdinal += 1;
        allNumbers.push(chapterNumber);
        entries[tocOrdinal - 1] = Object.freeze({
          tocOrdinal,
          numberedEntryOrdinal,
          labelledChapterNumber: chapterNumber,
          kind: "numbered-chapter",
          spineOrdinal,
          locatorId,
        });
      } else {
        entries[tocOrdinal - 1] = Object.freeze({
          tocOrdinal,
          numberedEntryOrdinal: null,
          labelledChapterNumber: null,
          kind: "section",
          spineOrdinal,
          locatorId,
        });
      }
    }
  }

  for (const ordinal of manifest.unassignedTocOrdinals) {
    entries[ordinal - 1] = Object.freeze({
      tocOrdinal: ordinal,
      numberedEntryOrdinal: null,
      labelledChapterNumber: null,
      kind: "section",
      spineOrdinal: ordinal === 1 ? 3 : manifest.spineItemCount,
      locatorId: "nav:" + ordinal.toString(16).padStart(32, "0"),
    });
  }

  const counts = new Map<number, number>();
  for (const number of allNumbers) counts.set(number, (counts.get(number) ?? 0) + 1);
  const repeatedNumberedLabelsAcrossEdition = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((left, right) => left - right);

  return Object.freeze({
    schemaVersion: 1,
    kind: "hoid-epub-structure-candidate",
    scope: "metadata-only",
    workSegmentation: "not-inferred",
    packageVersion: manifest.packageVersion,
    navigationFormat: manifest.navigationFormat,
    packageSha256: manifest.packageSha256,
    navigationSha256: manifest.navigationSha256,
    candidateFingerprint: manifest.candidateFingerprint,
    manifestItemCount: manifest.manifestItemCount,
    spineItemCount: manifest.spineItemCount,
    navigationEntryCount: manifest.navigationEntryCount,
    numberedTocEntryCount: manifest.numberedTocEntryCount,
    unnumberedTocEntryCount: manifest.unnumberedTocEntryCount,
    repeatedNumberedLabelsAcrossEdition: Object.freeze(repeatedNumberedLabelsAcrossEdition),
    entries: Object.freeze(entries),
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function cloneProbe(
  probe: HoidEpubStructureProbe,
  overrides: Partial<HoidEpubStructureProbe> = {},
): HoidEpubStructureProbe {
  return { ...probe, ...overrides };
}

describe("Hoid explicit EPUB work segmentation", () => {
  it("registers exactly the three structurally verified Roshar editions", () => {
    expect(HOID_EPUB_WORK_SEGMENTATION_MANIFESTS.map(item => item.editionId)).toEqual([
      "roshar-omnibus-v1",
      "edgedancer-epub-v1",
      "dawnshard-epub-v1",
    ]);
    expect(HOID_EPUB_WORK_SEGMENTATION_MANIFESTS.every(item =>
      /^[a-f0-9]{64}$/.test(item.mappingFingerprint),
    )).toBe(true);
    expect(getHoidEpubWorkSegmentationManifest("cosmere-epub-merged-v1")).toBeNull();
  });

  it("validates the five-work Roshar omnibus against its exact package and navigation fingerprints", () => {
    const manifest = getHoidEpubWorkSegmentationManifest("roshar-omnibus-v1");
    const validation = validateHoidEpubWorkSegmentation(buildProbe("roshar-omnibus-v1"), "roshar-omnibus-v1");
    expect(manifest).toMatchObject({
      packageSha256: "6eae99f8feccc93a57685108f0f8a8d6af68b7f1858eee63efcf710839cb7477",
      navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
      navigationEntryCount: 702,
      numberedTocEntryCount: 552,
      unnumberedTocEntryCount: 150,
    });
    expect(validation.status).toBe("verified-structure-only");
    if (validation.status !== "verified-structure-only") return;
    expect(validation.assignments).toHaveLength(700);
    expect(validation.unassignedTocOrdinals).toEqual([1, 702]);
    expect(new Set(validation.assignments.map(item => item.workId))).toEqual(
      new Set(["twok", "wor", "ob", "row", "sawt"]),
    );
    expect(validation.assignments.filter(item => item.kind === "numbered-chapter")).toHaveLength(552);
  });

  it("validates both standalone Roshar novellas with their independent EPUB 2 navigation", () => {
    for (const editionId of ["edgedancer-epub-v1", "dawnshard-epub-v1"]) {
      const validation = validateHoidEpubWorkSegmentation(buildProbe(editionId), editionId);
      expect(validation.status).toBe("verified-structure-only");
      if (validation.status === "verified-structure-only") {
        expect(validation.assignments.every(item => item.workId === (
          editionId === "edgedancer-epub-v1" ? "edgedancer" : "dawnshard"
        ))).toBe(true);
        expect(validation.unassignedTocOrdinals).toEqual([]);
      }
    }
  });

  it("keeps duplicate chapter numbers in Viento y Verdad as distinct locators", () => {
    const validation = validateHoidEpubWorkSegmentation(buildProbe("roshar-omnibus-v1"), "roshar-omnibus-v1");
    expect(validation.status).toBe("verified-structure-only");
    if (validation.status !== "verified-structure-only") return;
    for (const chapterNumber of [12, 14]) {
      const entries = validation.assignments.filter(item =>
        item.workId === "sawt" && item.chapterNumber === chapterNumber,
      );
      expect(entries).toHaveLength(2);
      expect(new Set(entries.map(item => item.locatorId)).size).toBe(2);
    }
  });

  it("does not assign global front matter or back matter to a novel", () => {
    const validation = validateHoidEpubWorkSegmentation(buildProbe("roshar-omnibus-v1"), "roshar-omnibus-v1");
    expect(validation.status).toBe("verified-structure-only");
    if (validation.status !== "verified-structure-only") return;
    expect(getHoidSegmentedNavigationEntry(validation, 1)).toBeNull();
    expect(getHoidSegmentedNavigationEntry(validation, 702)).toBeNull();
    expect(getHoidSegmentedNavigationEntry(validation, 33)?.workId).toBe("twok");
  });

  it("rejects a probe from a different package even when the edition ID is supplied", () => {
    const probe = buildProbe("roshar-omnibus-v1");
    const result = validateHoidEpubWorkSegmentation(
      cloneProbe(probe, { packageSha256: "0".repeat(64) }),
      "roshar-omnibus-v1",
    );
    expect(result).toMatchObject({ status: "unavailable", reason: "source-fingerprint-mismatch" });
  });

  it("rejects a probe from a different navigation revision", () => {
    const probe = buildProbe("edgedancer-epub-v1");
    const result = validateHoidEpubWorkSegmentation(
      cloneProbe(probe, { navigationSha256: "0".repeat(64) }),
      "edgedancer-epub-v1",
    );
    expect(result).toMatchObject({ status: "unavailable", reason: "source-fingerprint-mismatch" });
  });

  it("rejects duplicate opaque locators", () => {
    const probe = buildProbe("dawnshard-epub-v1");
    const entries = [...probe.entries];
    entries[1] = Object.freeze({ ...entries[1], locatorId: entries[0].locatorId });
    const result = validateHoidEpubWorkSegmentation(
      cloneProbe(probe, { entries: Object.freeze(entries) }),
      "dawnshard-epub-v1",
    );
    expect(result).toMatchObject({ status: "unavailable", reason: "invalid-probe" });
  });

  it("rejects a TOC entry whose spine target escapes its assigned work range", () => {
    const probe = buildProbe("roshar-omnibus-v1");
    const entries = [...probe.entries];
    entries[1] = Object.freeze({ ...entries[1], spineOrdinal: 1 });
    const result = validateHoidEpubWorkSegmentation(
      cloneProbe(probe, { entries: Object.freeze(entries) }),
      "roshar-omnibus-v1",
    );
    expect(result).toMatchObject({ status: "unavailable", reason: "segment-mismatch" });
  });

  it("rejects a missing chapter number instead of shifting the reading cursor", () => {
    const probe = buildProbe("roshar-omnibus-v1");
    const entries = [...probe.entries];
    entries[2] = Object.freeze({ ...entries[2], labelledChapterNumber: 999 });
    const result = validateHoidEpubWorkSegmentation(
      cloneProbe(probe, { entries: Object.freeze(entries) }),
      "roshar-omnibus-v1",
    );
    expect(result).toMatchObject({ status: "unavailable", reason: "chapter-number-mismatch" });
  });

  it("rejects any probe that claims chapter bodies were inspected or progress was unlocked", () => {
    const probe = buildProbe("edgedancer-epub-v1");
    const result = validateHoidEpubWorkSegmentation(
      cloneProbe(probe, { chapterBodiesInspected: true as unknown as false }),
      "edgedancer-epub-v1",
    );
    expect(result).toMatchObject({ status: "unavailable", reason: "invalid-probe" });
  });

  it("rejects accessors without invoking them", () => {
    let invoked = false;
    const probe = buildProbe("dawnshard-epub-v1");
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(probe)) {
      Object.defineProperty(hostile, key, {
        value: (probe as unknown as Record<string, unknown>)[key],
        enumerable: true,
      });
    }
    Object.defineProperty(hostile, "navigationSha256", {
      get() { invoked = true; return probe.navigationSha256; },
      enumerable: true,
    });
    expect(validateHoidEpubWorkSegmentation(hostile, "dawnshard-epub-v1"))
      .toMatchObject({ status: "unavailable", reason: "invalid-probe" });
    expect(invoked).toBe(false);
  });

  it("never returns titles, archive paths, prose or production authority", () => {
    const validation = validateHoidEpubWorkSegmentation(buildProbe("roshar-omnibus-v1"), "roshar-omnibus-v1");
    expect(validation.status).toBe("verified-structure-only");
    expect(JSON.stringify(validation)).not.toMatch(/href|chapter title|PRIVATE_BODY|El Camino de los Reyes/);
    expect(validation).toMatchObject({
      sourceContentIncluded: false,
      chapterBodiesInspected: false,
      progressUnlockGranted: false,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("keeps Cosmere segmentation unavailable until its current EPUB source is re-established", () => {
    expect(getHoidEpubWorkSegmentationManifest("cosmere-epub-merged-v1")).toBeNull();
    expect(validateHoidEpubWorkSegmentation({}, "cosmere-epub-merged-v1"))
      .toMatchObject({ status: "unavailable", reason: "unknown-edition" });
  });
});

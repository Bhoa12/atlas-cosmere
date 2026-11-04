import { ReadingSection, ReadingSectionKind, ReadingUnit, ReadingUnitKind } from '../model';
import { ROSHAR_WORK_IDS } from './works';
import { ROSHAR_EDITION_VARIANTS } from './editionVariants';
import { twokRows, twokSections } from './readingUnits/twok';
import { worRows, worSections } from './readingUnits/wor';
import { oRows, oSections } from './readingUnits/o';
import { rowRows, rowSections } from './readingUnits/row';
import { watRows, watSections } from './readingUnits/wat';
import { edgedancerRows, edgedancerSections } from './readingUnits/edgedancer';
import { dawnshardRows, dawnshardSections } from './readingUnits/dawnshard';

type UnitRow = readonly [ReadingUnitKind, string, number | null, number | null, string];
type SectionRow = readonly [ReadingSectionKind, string, number];
interface WorkRows {
  workId: string;
  editionVariantId: string;
  rows: readonly UnitRow[];
  sectionRows: readonly SectionRow[];
  sectionFamily: 'part' | 'day';
}

const WORK_ROWS: WorkRows[] = [
  { workId: 'twok', editionVariantId: 'epub-user-stormlight-1-5', rows: twokRows, sectionRows: twokSections, sectionFamily: 'part' },
  { workId: 'wor', editionVariantId: 'epub-user-stormlight-1-5-wor', rows: worRows, sectionRows: worSections, sectionFamily: 'part' },
  { workId: 'o', editionVariantId: 'epub-user-stormlight-1-5-o', rows: oRows, sectionRows: oSections, sectionFamily: 'part' },
  { workId: 'row', editionVariantId: 'epub-user-stormlight-1-5-row', rows: rowRows, sectionRows: rowSections, sectionFamily: 'part' },
  { workId: 'wat', editionVariantId: 'epub-user-stormlight-1-5-wat', rows: watRows, sectionRows: watSections, sectionFamily: 'day' },
  { workId: 'edgedancer', editionVariantId: 'epub-user-edgedancer', rows: edgedancerRows, sectionRows: edgedancerSections, sectionFamily: 'part' },
  { workId: 'dawnshard', editionVariantId: 'epub-user-dawnshard', rows: dawnshardRows, sectionRows: dawnshardSections, sectionFamily: 'part' }
];

function buildWorkCatalog(config: WorkRows): { units: ReadingUnit[]; sections: ReadingSection[] } {
  const sections: ReadingSection[] = config.sectionRows.map(([kind, label, ordinal]) => ({
    id: `${config.workId}:${kind}:${String(ordinal).padStart(3, '0')}`,
    workId: config.workId,
    kind,
    label,
    ordinal
  }));
  const kindOrdinals = new Map<ReadingUnitKind, number>();
  const units = config.rows.map(([kind, label, chapterNumber, sectionOrdinal, locator], index) => {
    const kindOrdinal = (kindOrdinals.get(kind) ?? 0) + 1;
    kindOrdinals.set(kind, kindOrdinal);
    const sectionKind: ReadingSectionKind | undefined = sectionOrdinal === null
      ? undefined
      : kind === 'interlude' || (kind === 'other' && config.workId === 'wat')
        ? 'interludes-block'
        : config.sectionFamily;
    const unit: ReadingUnit = {
      id: `${config.workId}:${kind}:${String(kindOrdinal).padStart(3, '0')}`,
      workId: config.workId,
      ordinal: index + 1,
      kind,
      label,
      ...(chapterNumber === null ? {} : { chapterNumber }),
      ...(sectionKind && sectionOrdinal !== null
        ? { sectionId: `${config.workId}:${sectionKind}:${String(sectionOrdinal).padStart(3, '0')}` }
        : {}),
      source: { editionVariantId: config.editionVariantId, locator }
    };
    return unit;
  });
  return { units, sections };
}

const BUILT_CATALOGS = WORK_ROWS.map(buildWorkCatalog);

export const ROSHAR_READING_UNITS: ReadingUnit[] = BUILT_CATALOGS.flatMap(catalog => catalog.units);
export const ROSHAR_READING_SECTIONS: ReadingSection[] = BUILT_CATALOGS.flatMap(catalog => catalog.sections);
export const ROSHAR_READING_UNIT_IDS = ROSHAR_READING_UNITS.map(unit => unit.id);
export const ROSHAR_READING_UNIT_WORK_BY_ID = new Map(
  ROSHAR_READING_UNITS.map(unit => [unit.id, unit.workId])
);

/** Expected NCX chapter counts, retained as explicit source-audit acceptance criteria. */
export const ROSHAR_NCX_EXPECTED_CHAPTER_COUNTS: Record<string, number> = {
  twok: 75,
  wor: 89,
  o: 122,
  row: 117,
  wat: 147,
  edgedancer: 20,
  dawnshard: 19
};

export function validateRosharReadingCatalog(): string[] {
  const issues: string[] = [];
  const knownWorks = new Set(ROSHAR_WORK_IDS);
  const knownEditions = new Map(ROSHAR_EDITION_VARIANTS.map(edition => [edition.id, edition]));
  const seenUnitIds = new Set<string>();
  const seenSectionIds = new Set<string>();
  const seenLocatorsByEdition = new Set<string>();

  for (const section of ROSHAR_READING_SECTIONS) {
    if (!knownWorks.has(section.workId)) issues.push(`Unknown work in section ${section.id}`);
    if (seenSectionIds.has(section.id)) issues.push(`Duplicate section ID ${section.id}`);
    seenSectionIds.add(section.id);
  }

  for (const unit of ROSHAR_READING_UNITS) {
    if (!knownWorks.has(unit.workId)) issues.push(`Unknown work in unit ${unit.id}`);
    if (seenUnitIds.has(unit.id)) issues.push(`Duplicate unit ID ${unit.id}`);
    seenUnitIds.add(unit.id);
    if (!unit.source || !unit.source.locator) issues.push(`Missing NCX locator for ${unit.id}`);
    const edition = unit.source && knownEditions.get(unit.source.editionVariantId);
    if (!edition || edition.workId !== unit.workId) issues.push(`Wrong edition variant for ${unit.id}`);
    if (unit.sectionId) {
      const section = ROSHAR_READING_SECTIONS.find(candidate => candidate.id === unit.sectionId);
      if (!section) {
        issues.push(`Unknown section ${unit.sectionId} for ${unit.id}`);
      } else if (section.workId !== unit.workId) {
        issues.push(`Cross-work section ${unit.sectionId} for ${unit.id}`);
      }
    }
    if (unit.source?.locator) {
      if (unit.source.locator.trim() !== unit.source.locator) {
        issues.push(`Unnormalized NCX locator for ${unit.id}`);
      }
      const locatorKey = `${unit.source.editionVariantId}::${unit.source.locator}`;
      if (seenLocatorsByEdition.has(locatorKey)) {
        issues.push(`Duplicate NCX locator ${unit.source.locator} in ${unit.source.editionVariantId}`);
      }
      seenLocatorsByEdition.add(locatorKey);
    }
  }

  for (const [workId, expected] of Object.entries(ROSHAR_NCX_EXPECTED_CHAPTER_COUNTS)) {
    const actual = ROSHAR_READING_UNITS.filter(unit => unit.workId === workId && unit.kind === 'chapter').length;
    if (actual !== expected) issues.push(`Work ${workId}: expected ${expected} NCX chapters, found ${actual}`);
  }

  for (const workId of Object.keys(ROSHAR_NCX_EXPECTED_CHAPTER_COUNTS)) {
    const units = ROSHAR_READING_UNITS.filter(unit => unit.workId === workId);
    if (units.some((unit, index) => unit.ordinal !== index + 1)) {
      issues.push(`Work ${workId}: reading-unit ordinals are not contiguous`);
    }
  }
  return issues;
}

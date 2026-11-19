import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidEditionProgressPolicy } from "./editionStructure";
import type { HoidEpubSourceDescriptor } from "./epubIngestion";

export type HoidEpubImportChoice = Readonly<{
  workId: string;
  title: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  editionId: string | null;
  progressMode:
    | "numeric-chapters"
    | "chapter-number-with-duplicate-locators"
    | "requires-volume-segmentation"
    | "collection-sections"
    | "unknown";
  supported: boolean;
}>;

/**
 * Return the catalogue choices in canonical bibliography order.
 * A filename is deliberately not an input: it cannot establish work or edition identity.
 */
export function getHoidEpubImportChoices(): readonly HoidEpubImportChoice[] {
  return Object.freeze(HOID_SOURCE_BIBLIOGRAPHY.map(work => {
    const policy = getHoidEditionProgressPolicy(work.id);
    if (policy.kind === "unknown") {
      return Object.freeze({
        workId: work.id,
        title: work.title,
        sourceGroup: work.sourceGroup,
        editionId: null,
        progressMode: "unknown" as const,
        supported: false,
      });
    }
    return Object.freeze({
      workId: work.id,
      title: work.title,
      sourceGroup: work.sourceGroup,
      editionId: policy.editionId,
      progressMode: policy.kind,
      supported: true,
    });
  }));
}

/**
 * Build a source descriptor only after the reader explicitly selects a catalogue
 * work and confirms its registered edition. Unknown, unsupported or mismatched
 * identities fail closed.
 */
export function createHoidEpubSourceDescriptor(
  sourceId: unknown,
  workId: unknown,
  editionId: unknown,
): HoidEpubSourceDescriptor | null {
  if (
    typeof sourceId !== "string" ||
    sourceId.length === 0 ||
    sourceId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(sourceId) ||
    typeof workId !== "string" ||
    typeof editionId !== "string"
  ) return null;

  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === workId);
  if (work === undefined) return null;
  const policy = getHoidEditionProgressPolicy(work.id);
  if (policy.kind === "unknown" || policy.editionId !== editionId) return null;

  return Object.freeze({
    sourceId,
    workId: work.id,
    editionId: policy.editionId,
    sourceGroup: work.sourceGroup,
  });
}

import { ReadingUnit, SpoilerGate, Progress, evaluateSpoilerGate } from "./cosmereExpansionRun53";

/**
 * Source-safe content registry.
 * Cards contain only original, short metadata written for the Atlas; protected
 * source text and quotations are deliberately excluded.
 */
export type SourceStatus = "verified-index" | "declared-private";

export type SourceRecord = {
  id: string;
  label: string;
  status: SourceStatus;
};

export type WorkRecord = {
  id: string;
  title: string;
  sourceId: string;
  worldId?: string;
};

export type ContentCard = {
  id: string;
  workId: string;
  title: string;
  summary: string;
  gate: SpoilerGate;
  sourceIds: string[];
};

export type ContentVisibility = {
  visible: boolean;
  reason: string;
  card?: ContentCard;
};

export function validateSourceSafeCatalogue(
  sources: readonly SourceRecord[],
  works: readonly WorkRecord[],
  units: readonly ReadingUnit[],
  cards: readonly ContentCard[],
): string[] {
  const errors: string[] = [];
  const duplicateIds = (items: readonly { id: string }[], kind: string) => {
    if (new Set(items.map((item) => item.id)).size !== items.length) errors.push("duplicate-" + kind + "-id");
  };
  duplicateIds(sources, "source");
  duplicateIds(works, "work");
  duplicateIds(units, "unit");
  duplicateIds(cards, "card");

  const sourceIds = new Set(sources.map((source) => source.id));
  const workIds = new Set(works.map((work) => work.id));
  for (const work of works) {
    if (!work.title.trim()) errors.push("empty-work-title");
    if (!sourceIds.has(work.sourceId)) errors.push("unknown-work-source");
  }
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push("unknown-unit-work");
    if (!Number.isInteger(unit.order) || unit.order < 1) errors.push("invalid-unit-order");
  }
  for (const card of cards) {
    if (!workIds.has(card.workId)) errors.push("unknown-card-work");
    if (!card.title.trim() || !card.summary.trim()) errors.push("empty-card-metadata");
    if (card.summary.length > 1200) errors.push("card-summary-too-long");
    if (card.gate.workId !== card.workId) errors.push("mismatched-card-gate");
    if (new Set(card.sourceIds).size !== card.sourceIds.length) errors.push("duplicate-card-source");
    if (card.sourceIds.some((id) => !sourceIds.has(id))) errors.push("unknown-card-source");
  }
  return errors;
}

/** Returns card metadata only when its explicit reading gate is satisfied. */
export function resolveContentCard(
  card: ContentCard,
  units: readonly ReadingUnit[],
  progress: Progress | undefined,
): ContentVisibility {
  const result = evaluateSpoilerGate(card.gate, units, progress);
  return result.revealed
    ? { visible: true, reason: result.reason, card }
    : { visible: false, reason: result.reason };
}

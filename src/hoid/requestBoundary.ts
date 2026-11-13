/**
 * Hoid IA request boundary.
 *
 * This module deliberately contains no SDK or provider dependency. Callers must
 * create a frozen reading snapshot once and use the resulting budget for the
 * whole request.
 */

export type Provenance = "catalog" | "editorial_summary";

export interface ReadingPosition {
  workId: string;
  chapter: number;
}

export interface EvidenceRecord {
  id: string;
  workId: string;
  maxChapter: number;
  provenance: Provenance;
  summary: string;
}

export interface KnowledgeBudget {
  readonly progress: readonly ReadingPosition[];
  readonly evidenceIds: readonly string[];
}

export interface ContextItem {
  evidenceId: string;
  workId: string;
  maxChapter: number;
  summary: string;
}

const validId = (value: string) => /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(value);

export function createKnowledgeBudget(
  progress: readonly ReadingPosition[],
  records: readonly EvidenceRecord[],
): KnowledgeBudget {
  const byWork = new Map<string, number>();

  for (const position of progress) {
    if (!validId(position.workId) || !Number.isInteger(position.chapter) || position.chapter < 0) {
      throw new Error("Invalid reading position");
    }
    const previous = byWork.get(position.workId);
    if (previous !== undefined && previous !== position.chapter) {
      throw new Error("Conflicting reading positions for the same work");
    }
    byWork.set(position.workId, position.chapter);
  }

  const evidenceIds = records
    .filter((record) => {
      if (!validId(record.id) || !validId(record.workId)) return false;
      if (!Number.isInteger(record.maxChapter) || record.maxChapter < 0) return false;
      if (record.provenance !== "catalog" && record.provenance !== "editorial_summary") return false;
      const chapter = byWork.get(record.workId);
      return chapter !== undefined && record.maxChapter <= chapter && record.summary.trim().length > 0;
    })
    .map((record) => record.id);

  return Object.freeze({
    progress: Object.freeze(progress.map((p) => Object.freeze({ ...p }))),
    evidenceIds: Object.freeze([...new Set(evidenceIds)]),
  });
}

export function buildAuthorizedContext(
  budget: KnowledgeBudget,
  records: readonly EvidenceRecord[],
  requestedEvidenceIds: readonly string[],
): readonly ContextItem[] {
  const allowed = new Set(budget.evidenceIds);
  const positions = new Map(budget.progress.map((p) => [p.workId, p.chapter]));
  const seen = new Set<string>();

  const byId = new Map(records.map((record) => [record.id, record]));
  const result: ContextItem[] = [];

  for (const id of requestedEvidenceIds) {
    if (!allowed.has(id) || seen.has(id)) continue;
    const record = byId.get(id);
    if (!record) continue;

    const chapter = positions.get(record.workId);
    if (chapter === undefined || record.maxChapter > chapter) continue;

    seen.add(id);
    result.push(Object.freeze({
      evidenceId: record.id,
      workId: record.workId,
      maxChapter: record.maxChapter,
      summary: record.summary,
    }));
  }

  return Object.freeze(result);
}

export function isContextWithinBudget(
  budget: KnowledgeBudget,
  context: readonly ContextItem[],
): boolean {
  const allowed = new Set(budget.evidenceIds);
  const positions = new Map(budget.progress.map((p) => [p.workId, p.chapter]));

  return context.every((item) => {
    const chapter = positions.get(item.workId);
    return allowed.has(item.evidenceId)
      && chapter !== undefined
      && Number.isInteger(item.maxChapter)
      && item.maxChapter >= 0
      && item.maxChapter <= chapter
      && item.summary.trim().length > 0;
  });
}

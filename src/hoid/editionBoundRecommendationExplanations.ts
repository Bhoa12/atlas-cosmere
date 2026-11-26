import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  getHoidReadingManifest,
  validateHoidReadingCursor,
  type HoidReadingCursor,
} from "./readingManifest";
import type {
  HoidEditionBoundRecommendation,
  HoidEditionBoundRecommendationResult,
  HoidRecommendationNavigationTarget,
  HoidResumeSelectionChoice,
} from "./editionBoundRecommendations";

export type HoidRecommendationExplanationCode = "resume-current-cursor";

export type HoidExplainedRecommendation = Readonly<{
  sourceId: string;
  title: string;
  reason: HoidEditionBoundRecommendation["reason"];
  explanationCode: HoidRecommendationExplanationCode;
  heading: string;
  detail: string;
  target: HoidRecommendationNavigationTarget;
}>;

export type HoidExplainedResumeChoice = Readonly<{
  sourceId: string;
  title: string;
  currentChapter: number;
  completedThroughChapter: number | null;
  detail: string;
}>;

export type HoidExplainedRecommendationResult =
  | Readonly<{
      status: "ready";
      progressRevision: number;
      items: readonly HoidExplainedRecommendation[];
    }>
  | Readonly<{
      status: "selection-required";
      progressRevision: number;
      heading: string;
      detail: string;
      choices: readonly HoidExplainedResumeChoice[];
    }>
  | Readonly<{
      status: "no-safe-next-work";
      reason: "no-active-work";
      progressRevision: number;
      heading: string;
      detail: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-progress"
        | "invalid-limit"
        | "invalid-active-work"
        | "invalid-recommendation";
    }>;

const CATALOG = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));
const CURSOR_KEYS = [
  "schemaVersion",
  "manifestId",
  "bookId",
  "unitId",
  "ordinal",
  "chapterNumber",
] as const;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function hasExactKeys(
  record: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  return Object.keys(record).length === expectedKeys.length &&
    expectedKeys.every(key => Object.prototype.hasOwnProperty.call(record, key));
}

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }

    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function canonicalCursor(value: unknown): HoidReadingCursor | null {
  const record = canonicalRecord(value, CURSOR_KEYS);
  if (!record || !hasExactKeys(record, CURSOR_KEYS)) return null;
  const candidate = Object.freeze({
    schemaVersion: record.schemaVersion,
    manifestId: record.manifestId,
    bookId: record.bookId,
    unitId: record.unitId,
    ordinal: record.ordinal,
    chapterNumber: record.chapterNumber,
  });
  const validation = validateHoidReadingCursor(candidate);
  return validation.status === "valid" ? validation.cursor : null;
}

function expectedTarget(
  sourceId: string,
  cursor: HoidReadingCursor,
): HoidRecommendationNavigationTarget {
  const validation = validateHoidReadingCursor(cursor);
  if (validation.status !== "valid" || validation.cursor.bookId !== sourceId) {
    return Object.freeze({ kind: "catalog-only", reason: "unit-not-found" });
  }
  const unit = validation.manifest.units.find(candidate =>
    candidate.id === validation.cursor.unitId &&
    candidate.ordinal === validation.cursor.ordinal &&
    candidate.chapterNumber === validation.cursor.chapterNumber
  );
  if (!unit) return Object.freeze({ kind: "catalog-only", reason: "unit-not-found" });
  return Object.freeze({
    kind: "edition-cursor",
    cursor: validation.cursor,
    editionId: validation.manifest.editionId,
    navigationSha256: validation.manifest.navigationSha256,
    locatorStatus: unit.locatorId ? "verified" : "cursor-only",
    ...(unit.locatorId ? { locatorId: unit.locatorId } : {}),
  });
}

function canonicalTarget(
  value: unknown,
  expected: HoidRecommendationNavigationTarget,
): HoidRecommendationNavigationTarget | null {
  if (expected.kind === "catalog-only") {
    const record = canonicalRecord(value, ["kind", "reason"]);
    if (
      !record ||
      !hasExactKeys(record, ["kind", "reason"]) ||
      record.kind !== "catalog-only" ||
      record.reason !== expected.reason
    ) return null;
    return expected;
  }

  const targetKeys = expected.locatorId
    ? ["kind", "cursor", "editionId", "navigationSha256", "locatorStatus", "locatorId"]
    : ["kind", "cursor", "editionId", "navigationSha256", "locatorStatus"];
  const record = canonicalRecord(value, targetKeys);
  if (
    !record ||
    !hasExactKeys(record, targetKeys) ||
    record.kind !== "edition-cursor" ||
    record.editionId !== expected.editionId ||
    record.navigationSha256 !== expected.navigationSha256 ||
    record.locatorStatus !== expected.locatorStatus ||
    (expected.locatorId !== undefined && record.locatorId !== expected.locatorId)
  ) return null;

  const cursor = canonicalRecord(record.cursor, CURSOR_KEYS);
  if (
    !cursor ||
    !hasExactKeys(cursor, CURSOR_KEYS) ||
    cursor.schemaVersion !== expected.cursor.schemaVersion ||
    cursor.manifestId !== expected.cursor.manifestId ||
    cursor.bookId !== expected.cursor.bookId ||
    cursor.unitId !== expected.cursor.unitId ||
    cursor.ordinal !== expected.cursor.ordinal ||
    cursor.chapterNumber !== expected.cursor.chapterNumber
  ) return null;

  return expected;
}

function expectedCompletedThroughChapter(
  sourceId: string,
  cursor: HoidReadingCursor,
): number | null | undefined {
  const validation = validateHoidReadingCursor(cursor);
  if (validation.status !== "valid" || validation.cursor.bookId !== sourceId) return undefined;
  const index = validation.manifest.units.findIndex(unit =>
    unit.id === validation.cursor.unitId &&
    unit.ordinal === validation.cursor.ordinal &&
    unit.chapterNumber === validation.cursor.chapterNumber
  );
  if (index < 0) return undefined;
  return index === 0 ? null : validation.manifest.units[index - 1]?.chapterNumber ?? null;
}

function canonicalResumeItem(
  record: Record<string, unknown>,
): HoidEditionBoundRecommendation | null {
  const keys = [
    "sourceId",
    "title",
    "reason",
    "currentChapter",
    "completedThroughChapter",
    "target",
  ];
  if (!hasExactKeys(record, keys)) return null;

  const sourceId = record.sourceId;
  const title = record.title;
  const currentChapter = record.currentChapter;
  if (
    typeof sourceId !== "string" ||
    typeof title !== "string" ||
    CATALOG.get(sourceId) !== title ||
    record.reason !== "resume-current-work" ||
    typeof currentChapter !== "number" ||
    !Number.isSafeInteger(currentChapter) ||
    currentChapter < 1
  ) return null;

  const rawTarget = canonicalRecord(record.target, [
    "kind", "cursor", "editionId", "navigationSha256", "locatorStatus", "locatorId",
  ]);
  if (!rawTarget || rawTarget.kind !== "edition-cursor") return null;
  const cursor = canonicalCursor(rawTarget.cursor);
  if (!cursor || cursor.bookId !== sourceId || cursor.chapterNumber !== currentChapter) return null;

  const expectedCompleted = expectedCompletedThroughChapter(sourceId, cursor);
  if (expectedCompleted === undefined || record.completedThroughChapter !== expectedCompleted) return null;

  const target = expectedTarget(sourceId, cursor);
  if (target.kind !== "edition-cursor" || !canonicalTarget(record.target, target)) return null;

  return Object.freeze({
    sourceId,
    title,
    reason: "resume-current-work",
    currentChapter,
    completedThroughChapter: expectedCompleted,
    target,
  });
}

function canonicalResumeChoice(
  value: unknown,
): HoidResumeSelectionChoice | null {
  const keys = ["sourceId", "title", "currentChapter", "completedThroughChapter", "cursor"];
  const record = canonicalRecord(value, keys);
  if (!record || !hasExactKeys(record, keys)) return null;

  const sourceId = record.sourceId;
  const title = record.title;
  const currentChapter = record.currentChapter;
  if (
    typeof sourceId !== "string" ||
    typeof title !== "string" ||
    CATALOG.get(sourceId) !== title ||
    typeof currentChapter !== "number" ||
    !Number.isSafeInteger(currentChapter) ||
    currentChapter < 1
  ) return null;

  const cursor = canonicalCursor(record.cursor);
  if (!cursor || cursor.bookId !== sourceId || cursor.chapterNumber !== currentChapter) return null;
  const expectedCompleted = expectedCompletedThroughChapter(sourceId, cursor);
  if (expectedCompleted === undefined || record.completedThroughChapter !== expectedCompleted) return null;

  return Object.freeze({
    sourceId,
    title,
    currentChapter,
    completedThroughChapter: expectedCompleted,
    cursor,
  });
}

function canonicalRecommendationResult(
  value: unknown,
): HoidEditionBoundRecommendationResult | null {
  const record = canonicalRecord(value, ["status", "reason", "progressRevision", "items", "choices"]);
  if (!record || typeof record.status !== "string") return null;
  if (record.status === "unavailable") {
    if (!hasExactKeys(record, ["status", "reason"]) ||
      (record.reason !== "invalid-progress" && record.reason !== "invalid-limit" &&
        record.reason !== "invalid-active-work")) return null;
    return Object.freeze({ status: "unavailable", reason: record.reason });
  }
  if (record.status === "no-safe-next-work") {
    if (!hasExactKeys(record, ["status", "reason", "progressRevision"]) ||
      record.reason !== "no-active-work" || !validRevision(record.progressRevision)) return null;
    return Object.freeze({
      status: "no-safe-next-work",
      reason: "no-active-work",
      progressRevision: record.progressRevision,
    });
  }
  if (!validRevision(record.progressRevision)) return null;
  if (record.status === "selection-required") {
    if (!hasExactKeys(record, ["status", "progressRevision", "choices"])) return null;
    const rawChoices = canonicalDenseArray(record.choices, HOID_SOURCE_BIBLIOGRAPHY.length);
    if (!rawChoices || rawChoices.length < 2) return null;
    const choices: HoidResumeSelectionChoice[] = [];
    const seen = new Set<string>();
    let previousIndex = -1;
    for (const rawChoice of rawChoices) {
      const choice = canonicalResumeChoice(rawChoice);
      if (!choice || seen.has(choice.sourceId)) return null;
      const index = HOID_SOURCE_BIBLIOGRAPHY.findIndex(work => work.id === choice.sourceId);
      if (index < 0 || index <= previousIndex) return null;
      previousIndex = index;
      seen.add(choice.sourceId);
      choices.push(choice);
    }
    return Object.freeze({
      status: "selection-required",
      progressRevision: record.progressRevision,
      choices: Object.freeze(choices),
    });
  }
  if (record.status !== "ready" || !hasExactKeys(record, ["status", "progressRevision", "items"])) return null;
  const rawItems = canonicalDenseArray(record.items, 1);
  if (!rawItems || rawItems.length > 1) return null;
  const items: HoidEditionBoundRecommendation[] = [];
  for (const rawItem of rawItems) {
    const itemRecord = canonicalRecord(rawItem, [
      "sourceId", "title", "reason", "currentChapter", "completedThroughChapter", "target",
    ]);
    if (!itemRecord) return null;
    const item = canonicalResumeItem(itemRecord);
    if (!item) return null;
    items.push(item);
  }
  return Object.freeze({
    status: "ready",
    progressRevision: record.progressRevision,
    items: Object.freeze(items),
  });
}

function explainTarget(target: HoidRecommendationNavigationTarget): string {
  if (target.kind === "catalog-only") {
    return target.reason === "segmentation-unverified"
      ? "La obra figura en el catálogo, pero su segmentación de capítulos no está verificada; no se inventa un capítulo ni una ruta de navegación."
      : "El manifiesto no contiene una unidad válida para este destino; no se inventa un localizador.";
  }

  if (target.locatorStatus === "cursor-only") {
    return "El cursor está vinculado a la edición y a su huella de navegación, pero no hay un localizador EPUB opaco verificado.";
  }

  return "El cursor y el localizador están vinculados al manifiesto y a la edición verificados.";
}

function explainRecommendation(
  item: HoidEditionBoundRecommendation,
): HoidExplainedRecommendation {
  const progressDetail = item.completedThroughChapter === null
    ? `No hay capítulos numerados completados; el cursor validado señala el capítulo ${item.currentChapter}.`
    : `El cursor validado señala el capítulo ${item.currentChapter}. El progreso registrado llega hasta el capítulo ${item.completedThroughChapter}.`;
  return Object.freeze({
    sourceId: item.sourceId,
    title: item.title,
    reason: item.reason,
    explanationCode: "resume-current-cursor",
    heading: `Reanudar ${item.title}`,
    detail: `${progressDetail} ${explainTarget(item.target)}`,
    target: item.target,
  });
}

function explainResumeChoice(choice: HoidResumeSelectionChoice): HoidExplainedResumeChoice {
  return Object.freeze({
    sourceId: choice.sourceId,
    title: choice.title,
    currentChapter: choice.currentChapter,
    completedThroughChapter: choice.completedThroughChapter,
    detail: choice.completedThroughChapter === null
      ? `El cursor está en el capítulo ${choice.currentChapter}; todavía no hay capítulos numerados completados.`
      : `El cursor está en el capítulo ${choice.currentChapter}; el progreso llega hasta el capítulo ${choice.completedThroughChapter}.`,
  });
}

/**
 * Add transparent, metadata-only explanations to a deterministic
 * edition-bound recommendation result.
 *
 * This exported formatter is itself a trust boundary: it accepts unknown,
 * copies plain data without invoking accessors, and re-derives every chapter,
 * cursor and locator from the checked-in edition manifest before producing
 * display text. Invalid or forged inputs fail closed.
 *
 * It does not inspect narrative content, infer reading order, authorize
 * evidence, change progress, or call a provider. The caller must still bind
 * the result to the authoritative progress snapshot and the navigation host
 * must revalidate the returned target immediately before opening a chapter.
 */
export function explainEditionBoundRecommendationResult(
  resultInput: unknown,
): HoidExplainedRecommendationResult {
  const result = canonicalRecommendationResult(resultInput);
  if (!result) return Object.freeze({ status: "unavailable", reason: "invalid-recommendation" });
  if (result.status === "unavailable") {
    return Object.freeze({ status: "unavailable", reason: result.reason });
  }
  if (result.status === "no-safe-next-work") {
    return Object.freeze({
      status: "no-safe-next-work",
      reason: "no-active-work",
      progressRevision: result.progressRevision,
      heading: "No hay una ruta de lectura aprobada",
      detail: "No tienes una obra en curso. Hoid no elegirá otra por orden bibliográfico ni por una cronología inferida. Hasta que exista una ruta de lectura revisada y autorizada, elige manualmente la obra que quieras empezar desde el Atlas.",
    });
  }
  if (result.status === "selection-required") {
    return Object.freeze({
      status: "selection-required",
      progressRevision: result.progressRevision,
      heading: "Elige qué obra quieres reanudar",
      detail: "Hay varias obras en curso. Hoid no elegirá una por ti ni sustituirá esa decisión por recomendaciones de descubrimiento.",
      choices: Object.freeze(result.choices.map(explainResumeChoice)),
    });
  }
  return Object.freeze({
    status: "ready",
    progressRevision: result.progressRevision,
    items: Object.freeze(result.items.map(explainRecommendation)),
  });
}

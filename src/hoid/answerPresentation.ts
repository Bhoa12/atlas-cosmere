import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import type { HoidEvidenceCitation } from "./evidenceScope";

export type HoidPresentedCitation = Readonly<{
  evidenceId: string;
  sourceBookId: string;
  title: string;
  chapter: number;
  locatorId: string;
}>;

export type HoidAnswerPresentation =
  | Readonly<{
      status: "ready";
      text: string;
      claimIds: readonly string[];
      evidenceIds: readonly string[];
      citations: readonly HoidPresentedCitation[];
    }>
  | Readonly<{
      status: "withheld";
      reason: "not-authorized" | "invalid-answer" | "invalid-progress" | "locked-evidence";
      text: string;
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_TEXT_LENGTH = 32_000;
const MAX_CLAIMS = 12;
const MAX_EVIDENCE = 16;
const SOURCE_KEYS = [
  "evidenceId",
  "sourceBookId",
  "sourceChapter",
  "locatorId",
  "unlockBookId",
  "unlockChapter",
] as const;

const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));

const WITHHELD_TEXT =
  "No hay afirmaciones editoriales verificadas y autorizadas para esta pregunta y tu progreso. Hoid no inventará una explicación.";

function withheld(
  reason: Extract<HoidAnswerPresentation, { status: "withheld" }>["reason"],
): HoidAnswerPresentation {
  return Object.freeze({ status: "withheld", reason, text: WITHHELD_TEXT });
}

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
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
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        descriptor.value.length > 128 ||
        !ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      ids.push(descriptor.value);
    }
    return Object.freeze(ids);
  } catch {
    return null;
  }
}

function canonicalSources(value: unknown): readonly HoidEvidenceCitation[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EVIDENCE) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const sources: HoidEvidenceCitation[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;

      const source = canonicalRecord(descriptor.value, SOURCE_KEYS, SOURCE_KEYS);
      if (!source) return null;
      const evidenceId = source.evidenceId;
      const sourceBookId = source.sourceBookId;
      const sourceChapter = source.sourceChapter;
      const locatorId = source.locatorId;
      const unlockBookId = source.unlockBookId;
      const unlockChapter = source.unlockChapter;

      if (
        typeof evidenceId !== "string" ||
        !ID_PATTERN.test(evidenceId) ||
        seen.has(evidenceId) ||
        typeof sourceBookId !== "string" ||
        !TITLES.has(sourceBookId) ||
        typeof sourceChapter !== "number" ||
        !Number.isSafeInteger(sourceChapter) ||
        sourceChapter < 1 ||
        typeof locatorId !== "string" ||
        locatorId.length < 1 ||
        locatorId.length > 256 ||
        /[\u0000-\u001F\u007F]/u.test(locatorId) ||
        typeof unlockBookId !== "string" ||
        unlockBookId !== sourceBookId ||
        typeof unlockChapter !== "number" ||
        !Number.isSafeInteger(unlockChapter) ||
        unlockChapter < sourceChapter
      ) return null;

      seen.add(evidenceId);
      sources.push(Object.freeze({
        evidenceId,
        sourceBookId,
        sourceChapter,
        locatorId,
        unlockBookId,
        unlockChapter,
      }));
    }
    return Object.freeze(sources);
  } catch {
    return null;
  }
}

function sourceIsUnlocked(
  source: HoidEvidenceCitation,
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[],
): boolean {
  const position = reading.find(item => item.bookId === source.unlockBookId);
  return Boolean(
    position &&
    (position.completed === true ||
      (typeof position.chapter === "number" && position.chapter >= source.unlockChapter)),
  );
}

/**
 * Converts an evidence-runtime result into a UI-safe answer with visible
 * source citations. It never forwards provider prose or blocked/abstained text.
 * Citation metadata is displayed only after every source unlock is rechecked
 * against the same authoritative cursor snapshot.
 */
export function presentHoidEvidenceAnswer(
  input: unknown,
  progressInput: unknown,
): HoidAnswerPresentation {
  const answer = canonicalRecord(
    input,
    ["status", "reason", "text", "claimIds", "evidenceIds", "sources"],
    ["status"],
  );
  if (!answer) return withheld("invalid-answer");

  if (answer.status === "blocked" || answer.status === "abstain") {
    return withheld("not-authorized");
  }
  if (answer.status !== "authorized") return withheld("invalid-answer");

  const authorized = canonicalRecord(
    input,
    ["status", "text", "claimIds", "evidenceIds", "sources"],
    ["status", "text", "claimIds", "evidenceIds", "sources"],
  );
  if (!authorized || Object.keys(authorized).length !== 5) return withheld("invalid-answer");

  const text = authorized.text;
  if (
    typeof text !== "string" ||
    text.length < 1 ||
    text.length > MAX_TEXT_LENGTH ||
    text !== text.trim() ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)
  ) return withheld("invalid-answer");

  const claimIds = canonicalIds(authorized.claimIds, MAX_CLAIMS);
  const evidenceIds = canonicalIds(authorized.evidenceIds, MAX_EVIDENCE);
  const sources = canonicalSources(authorized.sources);
  if (!claimIds || !evidenceIds || !sources) return withheld("invalid-answer");

  const sourceIds = sources.map(source => source.evidenceId);
  if (
    sourceIds.length !== evidenceIds.length ||
    new Set(sourceIds).size !== sourceIds.length ||
    JSON.stringify([...sourceIds].sort()) !== JSON.stringify([...evidenceIds].sort())
  ) return withheld("invalid-answer");

  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return withheld("invalid-progress");
  if (!sources.every(source => sourceIsUnlocked(source, projection.reading))) {
    return withheld("locked-evidence");
  }

  const citations = sources
    .map(source => Object.freeze({
      evidenceId: source.evidenceId,
      sourceBookId: source.sourceBookId,
      title: TITLES.get(source.sourceBookId)!,
      chapter: source.sourceChapter,
      locatorId: source.locatorId,
    }))
    .sort((left, right) =>
      left.sourceBookId < right.sourceBookId ? -1 :
      left.sourceBookId > right.sourceBookId ? 1 :
      left.chapter - right.chapter ||
      (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
    );

  return Object.freeze({
    status: "ready",
    text,
    claimIds,
    evidenceIds,
    citations: Object.freeze(citations),
  });
}

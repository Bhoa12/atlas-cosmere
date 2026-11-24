import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  canonicalizeHoidAnswerBookScope,
  selectedEvidenceSatisfiesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import { presentHoidEvidenceAnswer } from "./answerPresentation";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { getHoidReadingManifest } from "./readingManifest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import {
  createHoidChapterReference,
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";

export type HoidConversationScopeWork = Readonly<{
  bookId: string;
  chapters: readonly number[];
}>;

/**
 * Ephemeral, metadata-only binding for a conversational follow-up.
 * It preserves the exact works and cited chapters of the preceding authorized
 * answer, together with the progress identity that authorized those citations.
 * It contains no entity names, aliases, prose, EPUB locators or source text.
 */
export type HoidConversationScopeBinding = Readonly<{
  schemaVersion: 1;
  kind: "evidence-work-scope";
  scope: HoidAnswerBookScope;
  works: readonly HoidConversationScopeWork[];
  progressRevision: number;
  progressFingerprint: string;
}>;

export type HoidConversationScopeBindingValidation =
  | Readonly<{
      status: "ready";
      binding: HoidConversationScopeBinding;
      scope: HoidAnswerBookScope;
      chapterReferences: readonly HoidChapterReference[];
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "invalid-binding" | "stale-progress" | "scope-mismatch";
    }>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_WORKS = 4;
const MAX_CHAPTERS_PER_WORK = 16;
const issuedBindings = new WeakSet<object>();
// Exact chapter identities live beside the opaque session binding, never in
// its serializable shape or in provider/runtime request objects.
const chapterReferencesByBinding = new WeakMap<object, readonly HoidChapterReference[]>();
const WORK_IDS = new Set(HOID_SOURCE_BIBLIOGRAPHY.map(work => work.id));
const WORK_ORDER = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index]));

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expectedKeys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !expectedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(
  value: unknown,
  minimum: number,
  maximum: number,
): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
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
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function currentProgressIdentity(value: unknown): Readonly<{
  revision: number;
  fingerprint: string;
}> | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
}

function sameScope(left: HoidAnswerBookScope, right: HoidAnswerBookScope): boolean {
  return left.mode === right.mode &&
    left.bookIds.length === right.bookIds.length &&
    left.bookIds.every((bookId, index) => bookId === right.bookIds[index]);
}

function canonicalWorks(
  value: unknown,
  scope: HoidAnswerBookScope,
): readonly HoidConversationScopeWork[] | null {
  const rawWorks = canonicalDenseArray(value, scope.bookIds.length, MAX_WORKS);
  if (!rawWorks || rawWorks.length !== scope.bookIds.length) return null;

  const works: HoidConversationScopeWork[] = [];
  for (let index = 0; index < rawWorks.length; index += 1) {
    const record = exactDataRecord(rawWorks[index], ["bookId", "chapters"]);
    if (!record) return null;
    const bookId = record.bookId;
    if (typeof bookId !== "string" || bookId !== scope.bookIds[index] || !WORK_IDS.has(bookId)) {
      return null;
    }
    const chapters = canonicalDenseArray(record.chapters, 1, MAX_CHAPTERS_PER_WORK);
    if (!chapters) return null;
    const manifest = getHoidReadingManifest(bookId);
    if (manifest.status !== "ready") return null;

    const normalized: number[] = [];
    let previous = 0;
    for (const chapter of chapters) {
      if (
        typeof chapter !== "number" ||
        !Number.isSafeInteger(chapter) ||
        chapter < 1 ||
        chapter <= previous ||
        !manifest.manifest.units.some(unit => unit.chapterNumber === chapter)
      ) return null;
      normalized.push(chapter);
      previous = chapter;
    }
    works.push(Object.freeze({ bookId, chapters: Object.freeze(normalized) }));
  }
  return Object.freeze(works);
}

function canonicalChapterReferences(
  citations: readonly Readonly<{
    sourceBookId: string;
    chapter: number;
    locatorId: string;
  }>[],
): readonly HoidChapterReference[] | null {
  if (citations.length < 1 || citations.length > MAX_WORKS * MAX_CHAPTERS_PER_WORK) {
    return null;
  }

  const referencesByIdentity = new Map<string, HoidChapterReference>();
  for (const citation of citations) {
    const created = createHoidChapterReference(citation.sourceBookId, {
      chapterNumber: citation.chapter,
      locatorId: citation.locatorId,
    });
    if (
      created.status !== "ready" ||
      created.reference.labelAmbiguous ||
      created.reference.chapterNumber !== citation.chapter
    ) return null;

    const key = created.reference.bookId + "\n" + created.reference.unitId;
    const existing = referencesByIdentity.get(key);
    if (existing && (
      existing.ordinal !== created.reference.ordinal ||
      existing.identityFingerprint !== created.reference.identityFingerprint
    )) return null;
    referencesByIdentity.set(key, created.reference);
  }

  const references = [...referencesByIdentity.values()].sort((left, right) =>
    WORK_ORDER.get(left.bookId)! - WORK_ORDER.get(right.bookId)! ||
    left.ordinal - right.ordinal
  );
  return references.length > 0
    ? Object.freeze(references)
    : null;
}

function chapterReferencesMatchWorks(
  references: readonly HoidChapterReference[],
  works: readonly HoidConversationScopeWork[],
): boolean {
  if (
    references.length < 1 ||
    references.length > MAX_WORKS * MAX_CHAPTERS_PER_WORK
  ) return false;

  const expected = new Map<string, readonly number[]>(
    works.map(work => [work.bookId, work.chapters]),
  );
  const actual = new Map<string, number[]>();
  const seen = new Set<string>();

  for (const reference of references) {
    const validation = validateHoidChapterReference(reference);
    if (
      validation.status !== "valid" ||
      reference.labelAmbiguous ||
      !expected.has(reference.bookId)
    ) return false;
    const key = reference.bookId + "\n" + reference.unitId;
    if (seen.has(key)) return false;
    seen.add(key);
    const chapters = actual.get(reference.bookId) ?? [];
    chapters.push(reference.chapterNumber);
    actual.set(reference.bookId, chapters);
  }

  if (actual.size !== expected.size) return false;
  for (const [bookId, expectedChapters] of expected) {
    const actualChapters = actual.get(bookId);
    if (!actualChapters) return false;
    actualChapters.sort((left, right) => left - right);
    if (
      actualChapters.length !== expectedChapters.length ||
      actualChapters.some((chapter, index) => chapter !== expectedChapters[index])
    ) return false;
  }
  return true;
}

/**
 * Read the exact chapter identities associated with an issued session binding.
 * The returned references contain no EPUB locator or navigation hash. They are
 * context metadata only; evidence authorization must still be re-run separately.
 */
export function getHoidConversationScopeChapterReferences(
  value: unknown,
  progress: unknown,
  requestedScopeInput?: unknown,
): readonly HoidChapterReference[] | null {
  const validation = validateHoidConversationScopeBinding(
    value,
    progress,
    requestedScopeInput,
  );
  return validation.status === "ready" ? validation.chapterReferences : null;
}

/**
 * Creates a binding only from a fully presented answer whose citations have
 * already been checked against the current progress and edition manifests.
 * With no explicit scope, the cited work set becomes the scope for follow-ups;
 * a follow-up can therefore never silently widen to another authorized book.
 */
export function createHoidConversationScopeBinding(
  answerInput: HoidEvidenceAnswer | unknown,
  progress: unknown,
  requestedScopeInput?: unknown,
): HoidConversationScopeBinding | null {
  const identity = currentProgressIdentity(progress);
  if (!identity) return null;
  const presentation = presentHoidEvidenceAnswer(answerInput, progress);
  if (presentation.status !== "ready" || presentation.citations.length === 0) return null;

  const sourceBookIds = [...new Set(presentation.citations.map(citation => citation.sourceBookId))]
    .sort((left, right) => WORK_ORDER.get(left)! - WORK_ORDER.get(right)!);
  if (sourceBookIds.length < 1 || sourceBookIds.length > MAX_WORKS) return null;

  let scope: HoidAnswerBookScope | null;
  if (requestedScopeInput !== undefined) {
    scope = canonicalizeHoidAnswerBookScope(requestedScopeInput);
    if (!scope || !selectedEvidenceSatisfiesHoidBookScope(sourceBookIds, scope)) return null;
  } else {
    scope = canonicalizeHoidAnswerBookScope({
      mode: sourceBookIds.length === 1 ? "single-work" : "cross-work",
      bookIds: sourceBookIds,
    });
    if (!scope) return null;
  }

  const chaptersByBook = new Map<string, Set<number>>();
  for (const citation of presentation.citations) {
    let chapters = chaptersByBook.get(citation.sourceBookId);
    if (!chapters) {
      chapters = new Set<number>();
      chaptersByBook.set(citation.sourceBookId, chapters);
    }
    chapters.add(citation.chapter);
  }

  const works = scope.bookIds.map(bookId => Object.freeze({
    bookId,
    chapters: Object.freeze([...(chaptersByBook.get(bookId) ?? [])].sort((left, right) => left - right)),
  }));
  if (works.some(work => work.chapters.length === 0 || work.chapters.length > MAX_CHAPTERS_PER_WORK)) {
    return null;
  }

  const canonical = canonicalWorks(works, scope);
  if (!canonical) return null;
  const chapterReferences = canonicalChapterReferences(presentation.citations);
  if (!chapterReferences || !chapterReferencesMatchWorks(chapterReferences, canonical)) return null;
  const binding: HoidConversationScopeBinding = Object.freeze({
    schemaVersion: 1,
    kind: "evidence-work-scope",
    scope,
    works: canonical,
    progressRevision: identity.revision,
    progressFingerprint: identity.fingerprint,
  });
  issuedBindings.add(binding);
  chapterReferencesByBinding.set(binding, chapterReferences);
  return binding;
}

/**
 * Validates a stored follow-up binding against the live progress and any
 * explicitly selected UI scope. A mismatch is a hard abstention, not a reason
 * to fall back to automatic cross-book retrieval.
 */
export function validateHoidConversationScopeBinding(
  value: unknown,
  progress: unknown,
  requestedScopeInput?: unknown,
): HoidConversationScopeBindingValidation {
  const identity = currentProgressIdentity(progress);
  if (!identity) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  if (value === null || typeof value !== "object" || !issuedBindings.has(value)) {
    return Object.freeze({ status: "unavailable", reason: "invalid-binding" });
  }

  const record = exactDataRecord(value, [
    "schemaVersion",
    "kind",
    "scope",
    "works",
    "progressRevision",
    "progressFingerprint",
  ]);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.kind !== "evidence-work-scope" ||
    typeof record.progressRevision !== "number" ||
    !Number.isSafeInteger(record.progressRevision) ||
    record.progressRevision < 0 ||
    typeof record.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.progressFingerprint)
  ) return Object.freeze({ status: "unavailable", reason: "invalid-binding" });

  const scope = canonicalizeHoidAnswerBookScope(record.scope);
  if (!scope || scope.bookIds.length > MAX_WORKS) {
    return Object.freeze({ status: "unavailable", reason: "invalid-binding" });
  }
  const works = canonicalWorks(record.works, scope);
  if (!works) return Object.freeze({ status: "unavailable", reason: "invalid-binding" });
  const chapterReferences = chapterReferencesByBinding.get(value);
  if (!chapterReferences || !chapterReferencesMatchWorks(chapterReferences, works)) {
    return Object.freeze({ status: "unavailable", reason: "invalid-binding" });
  }

  if (
    record.progressRevision !== identity.revision ||
    record.progressFingerprint !== identity.fingerprint
  ) return Object.freeze({ status: "unavailable", reason: "stale-progress" });

  if (requestedScopeInput !== undefined) {
    const requestedScope = canonicalizeHoidAnswerBookScope(requestedScopeInput);
    if (!requestedScope) return Object.freeze({ status: "unavailable", reason: "invalid-binding" });
    if (!sameScope(scope, requestedScope)) {
      return Object.freeze({ status: "unavailable", reason: "scope-mismatch" });
    }
  }

  // Bindings are minted only by this module and deeply frozen at creation.
  // Return the exact issued object so callers can carry the WeakSet capability
  // across turns; cloning here would silently strip that capability.
  const binding = value as HoidConversationScopeBinding;
  return Object.freeze({ status: "ready", binding, scope, chapterReferences });
}

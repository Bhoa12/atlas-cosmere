import {
  createHoidEvidenceRuntime,
  type HoidApprovedClaim,
  type HoidClaimIntent,
  type HoidClaimSelector,
  type HoidEvidenceAnswer,
  type HoidRuntimeCallOptions,
} from "./evidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";
import { HoidKnowledgeCatalog } from "./catalog";
import { validatedKnowledge } from "./catalogValidation";
import {
  validateHoidApprovedClaimAttestation,
} from "./approvedClaimIntegrity";
import {
  canonicalizeHoidAnswerBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import {
  createHoidChapterReference,
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  isHoidExplanationDepth,
  resolveHoidExplanationDepthBudget,
  type HoidExplanationDepth,
} from "./explanationDepth";
import { validHoidQuestion } from "./requestValidation";
import {
  authorizeHoidUnitEvidence,
  type HoidUnitEvidencePolicy,
} from "./unitEvidenceAuthorization";
export type { HoidUnitEvidencePolicy } from "./unitEvidenceAuthorization";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  emptyHoidUnitProgressSnapshot,
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
} from "./unitProgressLedger";
import { validateHoidUnitProgressCursor } from "./unitProgressCursor";
import { sha256Hex } from "./sha256";
import type { HoidAnswerSelectionBudget, ReadingPosition } from "./types";
import type { HoidEvidenceAnswerSegment } from "./evidenceRuntime";

export type HoidUnitEvidenceCitation = Readonly<{
  evidenceId: string;
  source: HoidChapterReference;
  firstSafeAppearance: HoidChapterReference;
  unlock: HoidChapterReference;
}>;

export type HoidUnitEvidenceAnswer = Readonly<{
  status: HoidEvidenceAnswer["status"];
  reason?: HoidEvidenceAnswer["reason"];
  text: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  sources: readonly HoidUnitEvidenceCitation[];
  segments?: readonly HoidEvidenceAnswerSegment[];
  layout?: HoidEvidenceAnswer["layout"];
}>;

export type HoidUnitEvidenceRuntimeResult =
  | Readonly<{
      status: "ready";
      answer: HoidUnitEvidenceAnswer;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "progress-unavailable"
        | "progress-changed"
        | "invalid-policy"
        | "cancelled";
    }>;

export type HoidUnitReadingContext = Readonly<{
  status: "ready";
  progressRevision: number;
  progressFingerprint: string;
  works: readonly Readonly<{
    bookId: string;
    title: string;
    status: "in-progress" | "completed";
    currentChapterNumber?: number;
    currentOrdinal?: number;
    completedThroughOrdinal?: number | null;
  }>[];
}>;

export type HoidUnitReadingRecommendation =
  | Readonly<{
      sourceId: string;
      title: string;
      reason: "resume-current-unit";
      currentChapterNumber: number;
      currentOrdinal: number;
      completedThroughOrdinal: number | null;
    }>
  | Readonly<{
      sourceId: string;
      title: string;
      reason: "unstarted-source";
    }>;

export type HoidUnitRecommendationResult =
  | Readonly<{
      status: "ready";
      items: readonly HoidUnitReadingRecommendation[];
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{ status: "unavailable"; reason: "progress-unavailable" | "invalid-limit" }>;

export type HoidUnitPresentationReceipt = Readonly<{
  progressRevision: number;
  progressFingerprint: string;
  evidenceIds: readonly string[];
}>;

export type HoidUnitPresentationVerification =
  | Readonly<{ status: "ready"; progressRevision: number; progressFingerprint: string }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-receipt" | "progress-unavailable" | "progress-changed" | "evidence-locked";
    }>;

export type HoidUnitEvidenceRuntimeConfig = Readonly<{
  coordinator: HoidUnitProgressCoordinator;
  knowledge: readonly HoidKnowledgeEntry[];
  claims: readonly HoidApprovedClaim[];
  policies: readonly HoidUnitEvidencePolicy[];
  selector?: HoidClaimSelector | null;
  providerTimeoutMs?: number;
}>;

type CanonicalRequest = Readonly<{
  question: string;
  intent: HoidClaimIntent;
  depth: HoidExplanationDepth;
  entityIds?: readonly string[];
  bookScope?: HoidAnswerBookScope;
  chapterReferences?: readonly HoidChapterReference[];
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_KNOWLEDGE = 512;
const MAX_CLAIMS = 512;
const MAX_REFERENCES = 16;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const REQUEST_KEYS = new Set([
  "question",
  "intent",
  "depth",
  "entityIds",
  "bookScope",
  "chapterReferences",
]);

function unavailable(
  reason: Extract<HoidUnitEvidenceRuntimeResult, { status: "unavailable" }>["reason"],
): HoidUnitEvidenceRuntimeResult {
  return Object.freeze({ status: "unavailable", reason });
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasCallableMethod(value: unknown, methodName: string): boolean {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    let current: object | null = value;
    while (current && current !== Object.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(current, methodName);
      if (descriptor) {
        return Object.prototype.hasOwnProperty.call(descriptor, "value") &&
          typeof descriptor.value === "function";
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return false;
  } catch {
    return false;
  }
}

function exactRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
  required: readonly string[],
): Record<string, unknown> | null {
  const record = plainRecord(value);
  if (!record) return null;
  try {
    const keys = Reflect.ownKeys(record);
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
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

function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  const values = denseArray(value, maximum);
  if (!values || values.length < 1) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (
      typeof value !== "string" ||
      value !== value.trim() ||
      value.length < 1 ||
      value.length > 128 ||
      !ID_PATTERN.test(value) ||
      seen.has(value)
    ) return null;
    seen.add(value);
    ids.push(value);
  }
  return Object.freeze(ids);
}

function sameReference(left: HoidChapterReference, right: HoidChapterReference): boolean {
  return left.bookId === right.bookId &&
    left.ordinal === right.ordinal &&
    left.unitId === right.unitId &&
    left.identityFingerprint === right.identityFingerprint;
}

function sourceReferenceFor(entry: HoidKnowledgeEntry): HoidChapterReference | null {
  if (!entry.evidenceSource) return null;
  const created = createHoidChapterReference(entry.evidenceSource.bookId, {
    chapterNumber: entry.evidenceSource.chapter,
    locatorId: entry.evidenceSource.locatorId,
  });
  return created.status === "ready" ? created.reference : null;
}

function uniqueReferenceFor(bookId: string, chapterNumber: number): HoidChapterReference | null {
  const created = createHoidChapterReference(bookId, { chapterNumber });
  return created.status === "ready" ? created.reference : null;
}

function canonicalKnowledge(value: unknown): readonly HoidKnowledgeEntry[] | null {
  const raw = denseArray(value, MAX_KNOWLEDGE);
  if (!raw) return null;
  const canonical = validatedKnowledge(raw as readonly HoidKnowledgeEntry[]);
  if (canonical.length !== raw.length) return null;
  const seen = new Set<string>();
  for (const entry of canonical) {
    if (
      seen.has(entry.id) ||
      !entry.evidenceSource ||
      !entry.evidenceUnlock ||
      entry.provenance !== "verified" ||
      typeof entry.summary !== "string" ||
      entry.summary.length === 0
    ) return null;
    seen.add(entry.id);
  }
  return Object.freeze(canonical.map(entry => Object.freeze({
    ...entry,
    aliases: Object.freeze([...entry.aliases]) as unknown as string[],
    firstSafeAppearance: Object.freeze({ ...entry.firstSafeAppearance }),
    evidenceSource: Object.freeze({ ...entry.evidenceSource! }),
    evidenceUnlock: Object.freeze({ ...entry.evidenceUnlock! }),
  })));
}

function canonicalPolicies(
  value: unknown,
  knowledge: readonly HoidKnowledgeEntry[],
): readonly HoidUnitEvidencePolicy[] | null {
  const raw = denseArray(value, MAX_KNOWLEDGE);
  if (!raw || raw.length !== knowledge.length) return null;
  const entries = new Map(knowledge.map(entry => [entry.id, entry]));
  const seen = new Set<string>();
  const policies: HoidUnitEvidencePolicy[] = [];
  for (const candidate of raw) {
    const checked = authorizeHoidUnitEvidence(emptyHoidUnitProgressSnapshot(), candidate);
    if (checked.status !== "locked" || !plainRecord(candidate)) return null;
    const record = exactRecord(candidate, new Set([
      "evidenceId",
      "source",
      "firstSafeAppearance",
      "unlock",
    ]), ["evidenceId", "source", "firstSafeAppearance", "unlock"]);
    if (!record || typeof record.evidenceId !== "string" || seen.has(record.evidenceId)) return null;
    const entry = entries.get(record.evidenceId);
    if (!entry || !entry.evidenceSource || !entry.evidenceUnlock) return null;

    const source = validateHoidChapterReference(record.source);
    const first = validateHoidChapterReference(record.firstSafeAppearance);
    const unlock = validateHoidChapterReference(record.unlock);
    if (source.status !== "valid" || first.status !== "valid" || unlock.status !== "valid") return null;

    const expectedSource = sourceReferenceFor(entry);
    const expectedFirst = uniqueReferenceFor(
      entry.firstSafeAppearance.bookId,
      entry.firstSafeAppearance.chapter,
    );
    const expectedUnlock = uniqueReferenceFor(
      entry.evidenceUnlock.bookId,
      entry.evidenceUnlock.chapter,
    );
    // The current approved-claim attestation format still binds numeric
    // first-appearance/unlock metadata. Until its exact-unit successor lands,
    // duplicate labels at either threshold are deliberately rejected here.
    if (
      !expectedSource ||
      !expectedFirst ||
      !expectedUnlock ||
      first.reference.labelAmbiguous ||
      unlock.reference.labelAmbiguous ||
      !sameReference(source.reference, expectedSource) ||
      !sameReference(first.reference, expectedFirst) ||
      !sameReference(unlock.reference, expectedUnlock) ||
      record.evidenceId !== entry.id
    ) return null;

    const policy = Object.freeze({
      evidenceId: record.evidenceId,
      source: source.reference,
      firstSafeAppearance: first.reference,
      unlock: unlock.reference,
    });
    seen.add(record.evidenceId);
    policies.push(policy);
  }
  if (seen.size !== knowledge.length) return null;
  return Object.freeze(policies);
}

function canonicalClaims(
  value: unknown,
  knowledge: readonly HoidKnowledgeEntry[],
  policyIds: ReadonlySet<string>,
): readonly HoidApprovedClaim[] | null {
  const raw = denseArray(value, MAX_CLAIMS);
  if (!raw) return null;
  const seen = new Set<string>();
  const claims: HoidApprovedClaim[] = [];
  for (const candidate of raw) {
    const validated = validateHoidApprovedClaimAttestation(candidate, knowledge);
    if (validated.status !== "valid" || seen.has(validated.claim.id)) return null;
    if (!validated.claim.evidenceIds.every(id => policyIds.has(id))) return null;
    seen.add(validated.claim.id);
    claims.push(validated.claim);
  }
  return Object.freeze(claims);
}

function canonicalRequest(value: unknown, knownIds: ReadonlySet<string>): CanonicalRequest | null {
  const record = exactRecord(value, REQUEST_KEYS, ["question"]);
  if (!record) return null;
  const question = validHoidQuestion(record.question);
  if (!question) return null;
  const intent = record.intent === undefined ? "explain" : record.intent;
  if (intent !== "explain" && intent !== "recommend" && intent !== "context") return null;
  const depth = record.depth === undefined ? "detailed" : record.depth;
  if (!isHoidExplanationDepth(depth)) return null;

  let entityIds: readonly string[] | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "entityIds")) {
    const ids = canonicalIds(record.entityIds, 8);
    if (!ids || !ids.every(id => knownIds.has(id))) return null;
    entityIds = ids;
  }

  let bookScope: HoidAnswerBookScope | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "bookScope")) {
    const scope = canonicalizeHoidAnswerBookScope(record.bookScope);
    if (!scope) return null;
    bookScope = scope;
  }

  let chapterReferences: readonly HoidChapterReference[] | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "chapterReferences")) {
    const refs = denseArray(record.chapterReferences, MAX_REFERENCES);
    if (!refs || refs.length === 0) return null;
    const canonical: HoidChapterReference[] = [];
    const seen = new Set<string>();
    for (const ref of refs) {
      const validated = validateHoidChapterReference(ref);
      if (validated.status !== "valid" || seen.has(validated.reference.identityFingerprint)) return null;
      if (bookScope && !bookScope.bookIds.includes(validated.reference.bookId)) return null;
      seen.add(validated.reference.identityFingerprint);
      canonical.push(validated.reference);
    }
    chapterReferences = Object.freeze(canonical);
  }

  return Object.freeze({
    question,
    intent,
    depth,
    ...(entityIds ? { entityIds } : {}),
    ...(bookScope ? { bookScope } : {}),
    ...(chapterReferences ? { chapterReferences } : {}),
  });
}

function snapshotFingerprint(snapshot: HoidUnitProgressSnapshot): string {
  return sha256Hex(JSON.stringify(snapshot));
}

function referenceCompleted(
  snapshot: HoidUnitProgressSnapshot,
  reference: HoidChapterReference,
): boolean {
  const position = snapshot.positions.find(item => item.bookId === reference.bookId);
  if (!position) return false;
  if ("completed" in position && position.completed === true) return true;
  if (!("cursor" in position)) return false;
  const cursor = validateHoidUnitProgressCursor(position.cursor);
  return cursor.status === "valid" &&
    (cursor.boundary.completedThroughOrdinal ?? 0) >= reference.ordinal;
}

/**
 * The legacy runtime is a second, conservative filter. Only project a v3
 * position when its completed prefix has an unambiguous numeric representation.
 * Explicit whole-work completion remains an explicit v3 attestation.
 */
function legacyReadingForBook(
  snapshot: HoidUnitProgressSnapshot,
  bookId: string,
): ReadingPosition | null {
  const position = snapshot.positions.find(item => item.bookId === bookId);
  if (!position) return null;
  if ("completed" in position && position.completed === true) {
    return Object.freeze({ bookId, completed: true });
  }
  if (!("cursor" in position)) return null;
  const cursor = validateHoidUnitProgressCursor(position.cursor);
  if (cursor.status !== "valid" || !cursor.boundary.legacyReadingPosition) return null;
  return Object.freeze({
    bookId,
    chapter: cursor.boundary.legacyReadingPosition.chapter,
  });
}

function makeAnswer(
  status: HoidEvidenceAnswer["status"],
  text: string,
  reason?: HoidEvidenceAnswer["reason"],
): HoidUnitEvidenceAnswer {
  return Object.freeze({
    status,
    ...(reason ? { reason } : {}),
    text,
    claimIds: Object.freeze([]),
    evidenceIds: Object.freeze([]),
    sources: Object.freeze([]),
  });
}

function ready(
  answer: HoidUnitEvidenceAnswer,
  snapshot: HoidUnitProgressSnapshot,
): HoidUnitEvidenceRuntimeResult {
  return Object.freeze({
    status: "ready",
    answer,
    progressRevision: snapshot.revision,
    progressFingerprint: snapshotFingerprint(snapshot),
  });
}

export class HoidUnitEvidenceRuntime {
  private readonly catalog: HoidKnowledgeCatalog;
  private readonly policyById: ReadonlyMap<string, HoidUnitEvidencePolicy>;
  private readonly claimById: ReadonlyMap<string, HoidApprovedClaim>;

  private constructor(
    private readonly coordinator: HoidUnitProgressCoordinator,
    private readonly knowledge: readonly HoidKnowledgeEntry[],
    private readonly claims: readonly HoidApprovedClaim[],
    policies: readonly HoidUnitEvidencePolicy[],
    private readonly selector: HoidClaimSelector | null,
    private readonly providerTimeoutMs: number,
  ) {
    this.catalog = new HoidKnowledgeCatalog(knowledge);
    this.policyById = new Map(policies.map(policy => [policy.evidenceId, policy]));
    this.claimById = new Map(claims.map(claim => [claim.id, claim]));
  }

  static create(config: unknown): HoidUnitEvidenceRuntime | null {
    const record = exactRecord(config, new Set([
      "coordinator",
      "knowledge",
      "claims",
      "policies",
      "selector",
      "providerTimeoutMs",
    ]), ["coordinator", "knowledge", "claims", "policies"]);
    const coordinator = record?.coordinator;
    if (!record || !(coordinator instanceof HoidUnitProgressCoordinator)) return null;

    const knowledge = canonicalKnowledge(record.knowledge);
    if (!knowledge) return null;
    const policies = canonicalPolicies(record.policies, knowledge);
    if (!policies) return null;
    const policyIds = new Set(policies.map(policy => policy.evidenceId));
    const claims = canonicalClaims(record.claims, knowledge, policyIds);
    if (!claims) return null;

    const selector = record.selector === undefined || record.selector === null
      ? null
      : hasCallableMethod(record.selector, "selectClaims")
        ? record.selector as HoidClaimSelector
        : null;
    if (record.selector !== undefined && record.selector !== null && selector === null) return null;

    const timeout = record.providerTimeoutMs === undefined
      ? DEFAULT_TIMEOUT_MS
      : record.providerTimeoutMs;
    if (
      typeof timeout !== "number" ||
      !Number.isFinite(timeout) ||
      timeout <= 0 ||
      timeout > MAX_TIMEOUT_MS
    ) return null;

    return new HoidUnitEvidenceRuntime(
      coordinator,
      knowledge,
      claims,
      policies,
      selector,
      Math.ceil(timeout),
    );
  }

  async answer(input: unknown, options?: HoidRuntimeCallOptions): Promise<HoidUnitEvidenceRuntimeResult> {
    const knownIds = new Set(this.knowledge.map(entry => entry.id));
    const request = canonicalRequest(input, knownIds);
    if (!request) return unavailable("invalid-request");
    if (options?.signal?.aborted) return unavailable("cancelled");

    const before = await this.coordinator.refresh();
    if (before.status !== "ready") return unavailable("progress-unavailable");
    const snapshotValidation = validateHoidUnitProgressSnapshot(before.snapshot);
    if (snapshotValidation.status !== "valid") return unavailable("progress-unavailable");
    const snapshot = snapshotValidation.snapshot;
    const initialFingerprint = snapshotFingerprint(snapshot);

    const authorization = new Map<string, ReturnType<typeof authorizeHoidUnitEvidence>>();
    for (const [evidenceId, policy] of this.policyById) {
      const result = authorizeHoidUnitEvidence(snapshot, policy);
      if (result.status === "invalid") return unavailable("invalid-policy");
      authorization.set(evidenceId, result);
    }

    const matchedIds = this.catalog.findMatches(request.question).map(match => match.id);
    const requestedIds = request.entityIds ?? Object.freeze([]);
    for (const evidenceId of [...new Set([...matchedIds, ...requestedIds])]) {
      if (authorization.get(evidenceId)?.status !== "authorized") {
        return ready(
          makeAnswer(
            "blocked",
            "Esa pregunta puede revelar información que todavía no has alcanzado. Hoid conservará ese misterio.",
            "reading-position",
          ),
          snapshot,
        );
      }
    }

    if (request.chapterReferences?.some(reference => !referenceCompleted(snapshot, reference))) {
      return ready(
        makeAnswer(
          "blocked",
          "Ese ámbito incluye una unidad que todavía no has terminado. Hoid no adelantará su contenido.",
          "reading-position",
        ),
        snapshot,
      );
    }

    const allowedEntries = this.knowledge.filter(entry => {
      if (authorization.get(entry.id)?.status !== "authorized") return false;
      const sourceBookId = entry.evidenceSource?.bookId;
      if (!sourceBookId) return false;
      if (request.bookScope && !request.bookScope.bookIds.includes(sourceBookId)) return false;
      if (request.chapterReferences && !request.chapterReferences.some(reference =>
        sameReference(reference, this.policyById.get(entry.id)!.source)
      )) return false;
      // Never promote a non-projectable ordinal prefix into a legacy numeric
      // permission. The exact gate has authorized this evidence, but the
      // compatibility runtime must also be able to represent the same prefix.
      return legacyReadingForBook(snapshot, sourceBookId) !== null;
    });
    const allowedIds = new Set(allowedEntries.map(entry => entry.id));
    const allowedClaims = this.claims.filter(claim => {
      if (
        claim.intent !== request.intent ||
        !claim.evidenceIds.every(id => allowedIds.has(id)) ||
        (request.entityIds && !request.entityIds.every(id => claim.entityIds?.includes(id) === true))
      ) return false;
      if (request.bookScope) {
        const books = claim.evidenceIds.map(id => this.knowledge.find(entry => entry.id === id)?.evidenceSource?.bookId);
        if (books.some(bookId => typeof bookId !== "string" || !request.bookScope!.bookIds.includes(bookId))) return false;
        if (request.bookScope.mode === "cross-work" &&
            !request.bookScope.bookIds.every(bookId => books.includes(bookId))) return false;
      }
      return true;
    });

    if (allowedClaims.length === 0 || allowedEntries.length === 0) {
      return ready(
        makeAnswer(
          "abstain",
          "No hay afirmaciones editoriales verificadas y autorizadas para esta pregunta y tu progreso. Hoid no inventará una explicación.",
          "no-authorized-evidence",
        ),
        snapshot,
      );
    }
    if (!this.selector) {
      return ready(
        makeAnswer(
          "abstain",
          "No hay un selector de IA configurado. Hoid conserva las evidencias autorizadas sin generar contenido.",
          "provider-unavailable",
        ),
        snapshot,
      );
    }

    const projectedBooks: ReadingPosition[] = [];
    for (const bookId of [...new Set(allowedEntries.map(entry => entry.evidenceSource!.bookId))].sort()) {
      const position = legacyReadingForBook(snapshot, bookId);
      if (position) projectedBooks.push(position);
    }
    if (projectedBooks.length === 0) {
      return ready(
        makeAnswer(
          "abstain",
          "El progreso exacto no puede proyectarse sin ambigüedad para el filtro heredado. Hoid no ampliará el acceso.",
          "no-authorized-evidence",
        ),
        snapshot,
      );
    }
    const selectionBudget: HoidAnswerSelectionBudget | null =
      resolveHoidExplanationDepthBudget(request.depth);
    if (!selectionBudget) return unavailable("invalid-request");
    const innerRuntime = createHoidEvidenceRuntime({
      knowledge: allowedEntries,
      claims: allowedClaims,
      selector: this.selector,
      providerTimeoutMs: this.providerTimeoutMs,
    });
    if (!innerRuntime) return unavailable("invalid-policy");

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    if (options?.signal) {
      try {
        options.signal.addEventListener("abort", onCallerAbort, { once: true });
        if (options.signal.aborted) onCallerAbort();
      } catch {
        return unavailable("cancelled");
      }
    }
    const unsubscribe = this.coordinator.subscribe(() => controller.abort());

    let innerAnswer: HoidEvidenceAnswer;
    try {
      innerAnswer = await innerRuntime.answer({
        question: request.question,
        reading: projectedBooks,
        intent: request.intent,
        selectionBudget,
        ...(request.entityIds ? { entityIds: request.entityIds } : {}),
        ...(request.bookScope ? { bookScope: request.bookScope } : {}),
        ...(request.chapterReferences ? { chapterScope: request.chapterReferences } : {}),
      }, { signal: controller.signal });
    } catch {
      unsubscribe();
      options?.signal?.removeEventListener("abort", onCallerAbort);
      return unavailable("progress-unavailable");
    }
    unsubscribe();
    options?.signal?.removeEventListener("abort", onCallerAbort);

    const after = await this.coordinator.refresh();
    if (after.status !== "ready") return unavailable("progress-unavailable");
    const afterValidation = validateHoidUnitProgressSnapshot(after.snapshot);
    if (afterValidation.status !== "valid") return unavailable("progress-unavailable");
    const latest = afterValidation.snapshot;
    const latestFingerprint = snapshotFingerprint(latest);
    if (
      latest.revision !== snapshot.revision ||
      latestFingerprint !== initialFingerprint
    ) return unavailable(options?.signal?.aborted ? "cancelled" : "progress-changed");
    if (options?.signal?.aborted) return unavailable("cancelled");
    if (controller.signal.aborted) return unavailable("progress-changed");

    if (innerAnswer.status !== "authorized") {
      return ready(
        makeAnswer(innerAnswer.status, innerAnswer.text, innerAnswer.reason),
        latest,
      );
    }

    const evidenceIds = [...innerAnswer.evidenceIds];
    const claimIds = [...innerAnswer.claimIds];
    const selectedClaims = claimIds.map(id => this.claimById.get(id));
    if (
      evidenceIds.length === 0 ||
      claimIds.length === 0 ||
      evidenceIds.some(id => !this.policyById.has(id)) ||
      selectedClaims.some(claim => !claim)
    ) return unavailable("invalid-policy");

    const expectedEvidenceIds = [...new Set(
      (selectedClaims as HoidApprovedClaim[]).flatMap(claim => claim.evidenceIds),
    )].sort();
    if (
      expectedEvidenceIds.length !== evidenceIds.length ||
      expectedEvidenceIds.some((id, index) => id !== [...evidenceIds].sort()[index]) ||
      !innerAnswer.segments ||
      innerAnswer.segments.length !== selectedClaims.length ||
      innerAnswer.segments.some((segment, index) => {
        const claim = selectedClaims[index]!;
        return segment.claimId !== claim.id ||
          segment.text !== claim.text ||
          segment.evidenceIds.length !== claim.evidenceIds.length ||
          segment.evidenceIds.some((id, evidenceIndex) => id !== claim.evidenceIds[evidenceIndex]);
      }) ||
      innerAnswer.text !== innerAnswer.segments.map(segment => segment.text).join("\n\n")
    ) return unavailable("invalid-policy");

    for (const claim of selectedClaims as HoidApprovedClaim[]) {
      if (
        claim.intent !== request.intent ||
        !claim.evidenceIds.every(id => authorization.get(id)?.status === "authorized")
      ) return unavailable("invalid-policy");
    }

    for (const evidenceId of evidenceIds) {
      const result = authorizeHoidUnitEvidence(latest, this.policyById.get(evidenceId));
      if (result.status !== "authorized") return unavailable("progress-changed");
    }

    const sources = evidenceIds.map(evidenceId => {
      const policy = this.policyById.get(evidenceId)!;
      return Object.freeze({
        evidenceId,
        source: policy.source,
        firstSafeAppearance: policy.firstSafeAppearance,
        unlock: policy.unlock,
      });
    });
    const answer: HoidUnitEvidenceAnswer = Object.freeze({
      status: "authorized",
      text: innerAnswer.text,
      claimIds: Object.freeze(claimIds),
      evidenceIds: Object.freeze(evidenceIds),
      sources: Object.freeze(sources),
      ...(innerAnswer.segments ? { segments: innerAnswer.segments } : {}),
      ...(innerAnswer.layout ? { layout: innerAnswer.layout } : {}),
    });
    return ready(answer, latest);
  }

  async readingContext(): Promise<HoidUnitReadingContext | null> {
    const refreshed = await this.coordinator.refresh();
    if (refreshed.status !== "ready") return null;
    const validation = validateHoidUnitProgressSnapshot(refreshed.snapshot);
    if (validation.status !== "valid") return null;
    const fingerprint = snapshotFingerprint(validation.snapshot);
    const works = validation.snapshot.positions.map(position => {
      const source = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === position.bookId);
      if (!source) return null;
      if ("completed" in position) {
        return Object.freeze({
          bookId: position.bookId,
          title: source.title,
          status: "completed" as const,
        });
      }
      const cursor = validateHoidUnitProgressCursor(position.cursor);
      if (cursor.status !== "valid") return null;
      return Object.freeze({
        bookId: position.bookId,
        title: source.title,
        status: "in-progress" as const,
        currentChapterNumber: cursor.cursor.reference.chapterNumber,
        currentOrdinal: cursor.cursor.reference.ordinal,
        completedThroughOrdinal: cursor.boundary.completedThroughOrdinal,
      });
    });
    if (works.some(work => work === null)) return null;
    return Object.freeze({
      status: "ready",
      progressRevision: validation.snapshot.revision,
      progressFingerprint: fingerprint,
      works: Object.freeze(works as HoidUnitReadingContext["works"]),
    });
  }

  async recommend(limit = 3): Promise<HoidUnitRecommendationResult> {
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > HOID_SOURCE_BIBLIOGRAPHY.length) {
      return Object.freeze({ status: "unavailable", reason: "invalid-limit" });
    }
    const refreshed = await this.coordinator.refresh();
    if (refreshed.status !== "ready") {
      return Object.freeze({ status: "unavailable", reason: "progress-unavailable" });
    }
    const validation = validateHoidUnitProgressSnapshot(refreshed.snapshot);
    if (validation.status !== "valid") {
      return Object.freeze({ status: "unavailable", reason: "progress-unavailable" });
    }
    const snapshot = validation.snapshot;
    const started = new Set(snapshot.positions.map(position => position.bookId));
    const items: HoidUnitReadingRecommendation[] = [];

    for (const position of snapshot.positions) {
      if (!("cursor" in position)) continue;
      const cursor = validateHoidUnitProgressCursor(position.cursor);
      const source = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === position.bookId);
      if (cursor.status !== "valid" || !source) continue;
      items.push(Object.freeze({
        sourceId: source.id,
        title: source.title,
        reason: "resume-current-unit",
        currentChapterNumber: cursor.cursor.reference.chapterNumber,
        currentOrdinal: cursor.cursor.reference.ordinal,
        completedThroughOrdinal: cursor.boundary.completedThroughOrdinal,
      }));
    }

    for (const source of HOID_SOURCE_BIBLIOGRAPHY) {
      if (items.length >= limit) break;
      if (started.has(source.id)) continue;
      items.push(Object.freeze({
        sourceId: source.id,
        title: source.title,
        reason: "unstarted-source",
      }));
    }
    return Object.freeze({
      status: "ready",
      items: Object.freeze(items.slice(0, limit)),
      progressRevision: snapshot.revision,
      progressFingerprint: snapshotFingerprint(snapshot),
    });
  }

  async verifyForPresentation(receiptInput: unknown): Promise<HoidUnitPresentationVerification> {
    const record = exactRecord(receiptInput, new Set([
      "progressRevision",
      "progressFingerprint",
      "evidenceIds",
    ]), ["progressRevision", "progressFingerprint", "evidenceIds"]);
    if (
      !record ||
      typeof record.progressRevision !== "number" ||
      !Number.isSafeInteger(record.progressRevision) ||
      record.progressRevision < 0 ||
      typeof record.progressFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/u.test(record.progressFingerprint)
    ) return Object.freeze({ status: "unavailable", reason: "invalid-receipt" });
    const rawEvidenceIds = denseArray(record.evidenceIds, 16);
    if (!rawEvidenceIds) return Object.freeze({ status: "unavailable", reason: "invalid-receipt" });
    const evidenceIds = rawEvidenceIds.length === 0
      ? Object.freeze([] as string[])
      : canonicalIds(rawEvidenceIds, 16);
    if (!evidenceIds) return Object.freeze({ status: "unavailable", reason: "invalid-receipt" });

    const refreshed = await this.coordinator.refresh();
    if (refreshed.status !== "ready") {
      return Object.freeze({ status: "unavailable", reason: "progress-unavailable" });
    }
    const validation = validateHoidUnitProgressSnapshot(refreshed.snapshot);
    if (validation.status !== "valid") {
      return Object.freeze({ status: "unavailable", reason: "progress-unavailable" });
    }
    const snapshot = validation.snapshot;
    const fingerprint = snapshotFingerprint(snapshot);
    if (
      snapshot.revision !== record.progressRevision ||
      fingerprint !== record.progressFingerprint
    ) return Object.freeze({ status: "unavailable", reason: "progress-changed" });

    for (const evidenceId of evidenceIds) {
      const policy = this.policyById.get(evidenceId);
      if (!policy || authorizeHoidUnitEvidence(snapshot, policy).status !== "authorized") {
        return Object.freeze({ status: "unavailable", reason: "evidence-locked" });
      }
    }
    return Object.freeze({
      status: "ready",
      progressRevision: snapshot.revision,
      progressFingerprint: fingerprint,
    });
  }
}

export function createHoidUnitEvidenceRuntime(
  config: unknown,
): HoidUnitEvidenceRuntime | null {
  return HoidUnitEvidenceRuntime.create(config);
}

import { isHoidKnowledgeKind, type HoidKnowledgeKind } from "./knowledgeKinds";
import { validateHoidExactApprovedClaimAttestation, type HoidExactApprovedClaim, type HoidExactEvidenceRecord } from "./exactUnitClaimIntegrity";
import {
  canonicalizeHoidExactUnitEvidencePolicy,
  authorizeHoidExactUnitEvidence,
  type HoidExactUnitEvidencePolicy,
} from "./unitEvidenceAuthorizationV2";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
} from "./unitProgressLedger";
import {
  canonicalizeHoidAnswerBookScope,
  claimEvidenceMatchesHoidBookScope,
  selectedEvidenceSatisfiesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import { canonicalizeHoidChapterEvidenceScope } from "./chapterEvidenceScope";
import type { HoidChapterReference } from "./chapterReference";
import {
  isHoidExplanationDepth,
  resolveHoidExplanationDepthBudget,
  type HoidExplanationDepth,
} from "./explanationDepth";
import { validHoidQuestion } from "./requestValidation";
import { invokeWithProviderDeadline } from "./providerTimeout";
import { sha256Hex } from "./sha256";
import type { HoidAnswerSelectionBudget } from "./types";
import { isKnownHoidSource } from "./bibliography";

export type HoidExactClaimPackage = Readonly<{
  claim: HoidExactApprovedClaim;
  evidence: readonly HoidExactEvidenceRecord[];
  policies: readonly HoidExactUnitEvidencePolicy[];
}>;

export type HoidExactClaimSelectionCandidate = Readonly<{
  id: string;
  text: string;
  evidenceIds: readonly string[];
}>;

export type HoidExactConversationSelectionContext = Readonly<{
  schemaVersion: 1;
  priorClaimIds: readonly string[];
  entityIds: readonly string[];
  bookIds: readonly string[];
}>;

export type HoidExactClaimSelectionRequest = Readonly<{
  schemaVersion: 2 | 3;
  requestFingerprint: string;
  question: string;
  intent: "explain" | "recommend" | "context";
  candidates: readonly HoidExactClaimSelectionCandidate[];
  selectionBudget: HoidAnswerSelectionBudget;
  /** Bounded metadata only: never includes progress, chapter refs, or answer prose. */
  conversationContext?: HoidExactConversationSelectionContext;
}>;

export type HoidExactClaimSelectionContext = Readonly<{
  signal: AbortSignal;
}>;

export interface HoidExactClaimSelector {
  selectClaims(
    request: HoidExactClaimSelectionRequest,
    context: HoidExactClaimSelectionContext,
  ): Promise<unknown>;
}

export type HoidExactEvidenceCitation = Readonly<{
  evidenceId: string;
  source: HoidExactUnitEvidencePolicy["source"];
  firstSafeAppearance: HoidExactUnitEvidencePolicy["firstSafeAppearance"];
  unlock: HoidExactUnitEvidencePolicy["unlock"];
}>;

export type HoidExactEvidenceAnswerSegment = Readonly<{
  claimId: string;
  text: string;
  evidenceIds: readonly string[];
  sources: readonly HoidExactEvidenceCitation[];
}>;

export type HoidExactEvidenceAnswer = Readonly<{
  text: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  /** Entity IDs come only from the selected, signed editorial claims. */
  entityIds: readonly string[];
  sources: readonly HoidExactEvidenceCitation[];
  segments: readonly HoidExactEvidenceAnswerSegment[];
  layout: "plain" | "grouped";
}>;

export type HoidExactEvidenceRuntimeResult =
  | Readonly<{
      status: "ready";
      answer: HoidExactEvidenceAnswer;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "progress-unavailable"
        | "evidence-locked"
        | "no-authorized-claims"
        | "selector-unavailable"
        | "provider-timeout"
        | "provider-failed"
        | "cancelled"
        | "progress-changed"
        | "invalid-selection"
        | "too-many-candidates"
        | "depth-budget-exceeded"
        | "comparison-provenance-required";
    }>;

export type HoidExactPresentationReceipt = Readonly<{
  progressRevision: number;
  progressFingerprint: string;
  evidenceIds: readonly string[];
}>;

export type HoidExactPresentationVerification =
  | Readonly<{ status: "ready"; progressRevision: number; progressFingerprint: string }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-receipt" | "progress-unavailable" | "progress-changed" | "evidence-locked";
    }>;

export type HoidExactRuntimeCallOptions = Readonly<{
  signal?: AbortSignal;
}>;

export type HoidExactEvidenceRuntimeConfig = Readonly<{
  coordinator: HoidUnitProgressCoordinator;
  packages: readonly HoidExactClaimPackage[];
  selector?: HoidExactClaimSelector | null;
  providerTimeoutMs?: number;
}>;

type CanonicalRequest = Readonly<{
  question: string;
  intent: "explain" | "recommend" | "context";
  depth: HoidExplanationDepth;
  entityIds?: readonly string[];
  bookScope?: HoidAnswerBookScope;
  /** Exact prior-answer chapters; local retrieval constraint only, never provider egress. */
  chapterScope?: readonly HoidChapterReference[];
  conversationContext?: HoidExactConversationSelectionContext;
}>;

type CanonicalPackage = Readonly<{
  claim: HoidExactApprovedClaim;
  evidence: readonly HoidExactEvidenceRecord[];
  policies: readonly HoidExactUnitEvidencePolicy[];
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const INTENTS = new Set(["explain", "recommend", "context"]);
const MAX_PACKAGES = 512;
const MAX_EVIDENCE_PER_CLAIM = 16;
const MAX_CANDIDATES = 32;
const MAX_SELECTED_CLAIMS = 12;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const REQUEST_KEYS = new Set(["question", "intent", "depth", "entityIds", "bookScope", "chapterScope", "conversationContext"]);
const PACKAGE_KEYS = new Set(["claim", "evidence", "policies"]);
const EVIDENCE_KEYS = new Set(["id", "aliases", "kind", "provenance", "summary"]);
const RESPONSE_KEYS = new Set(["schemaVersion", "requestFingerprint", "claimIds"]);
const RECEIPT_KEYS = new Set(["progressRevision", "progressFingerprint", "evidenceIds"]);

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

function exactRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
  required: readonly string[],
): Record<string, unknown> | null {
  const record = plainRecord(value);
  if (!record) return null;
  try {
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(record)) {
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

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
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

function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  const raw = denseArray(value, 1, maximum);
  if (!raw) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (
      typeof item !== "string" ||
      item !== item.trim() ||
      item.length < 1 ||
      item.length > 128 ||
      !ID_PATTERN.test(item) ||
      seen.has(item)
    ) return null;
    seen.add(item);
    ids.push(item);
  }
  return Object.freeze(ids.sort());
}

function canonicalContextIds(value: unknown, minimum: number, maximum: number): readonly string[] | null {
  const raw = denseArray(value, minimum, maximum);
  if (!raw) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || item !== item.trim() || item.length < 1 ||
      item.length > 128 || !ID_PATTERN.test(item) || seen.has(item)) return null;
    seen.add(item);
    ids.push(item);
  }
  return Object.freeze(ids.sort());
}

function canonicalConversationContext(value: unknown): HoidExactConversationSelectionContext | null {
  const record = exactRecord(value,
    new Set(["schemaVersion", "priorClaimIds", "entityIds", "bookIds"]),
    ["schemaVersion", "priorClaimIds", "entityIds", "bookIds"]);
  if (!record || record.schemaVersion !== 1) return null;
  const priorClaimIds = canonicalContextIds(record.priorClaimIds, 1, 12);
  const entityIds = canonicalContextIds(record.entityIds, 0, 8);
  const bookIds = canonicalContextIds(record.bookIds, 0, 4);
  if (!priorClaimIds || !entityIds || !bookIds || !bookIds.every(isKnownHoidSource)) return null;
  return Object.freeze({ schemaVersion: 1, priorClaimIds, entityIds, bookIds });
}

function canonicalEvidence(value: unknown): HoidExactEvidenceRecord | null {
  const record = exactRecord(value, EVIDENCE_KEYS, ["id", "aliases", "kind", "provenance", "summary"]);
  if (
    !record ||
    typeof record.id !== "string" ||
    record.id !== record.id.trim() ||
    record.id.length < 1 ||
    record.id.length > 128 ||
    !ID_PATTERN.test(record.id) ||
    !isHoidKnowledgeKind(record.kind) ||
    record.provenance !== "verified" ||
    typeof record.summary !== "string" ||
    record.summary !== record.summary.trim() ||
    record.summary.length < 1 ||
    record.summary.length > 4_000 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(record.summary)
  ) return null;
  const aliasesRaw = denseArray(record.aliases, 1, 64);
  if (!aliasesRaw) return null;
  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const alias of aliasesRaw) {
    if (
      typeof alias !== "string" ||
      alias !== alias.trim() ||
      alias.length < 1 ||
      alias.length > 256 ||
      /[\u0000-\u001F\u007F]/u.test(alias) ||
      seen.has(alias)
    ) return null;
    seen.add(alias);
    aliases.push(alias);
  }
  aliases.sort();
  return Object.freeze({
    id: record.id,
    aliases: Object.freeze(aliases),
    kind: record.kind,
    provenance: "verified",
    summary: record.summary,
  });
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

function canonicalRequest(value: unknown): CanonicalRequest | null {
  const record = exactRecord(value, REQUEST_KEYS, ["question", "intent"]);
  if (!record) return null;
  const question = validHoidQuestion(record.question);
  if (
    !question ||
    typeof record.intent !== "string" ||
    !INTENTS.has(record.intent)
  ) return null;
  const depth = record.depth === undefined ? "brief" : record.depth;
  if (!isHoidExplanationDepth(depth)) return null;

  let entityIds: readonly string[] | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "entityIds")) {
    const parsed = canonicalIds(record.entityIds, 8);
    if (!parsed) return null;
    entityIds = parsed;
  }
  let bookScope: HoidAnswerBookScope | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "bookScope")) {
    const parsed = canonicalizeHoidAnswerBookScope(record.bookScope);
    if (!parsed) return null;
    bookScope = parsed;
  }
  let chapterScope: readonly HoidChapterReference[] | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "chapterScope")) {
    if (!bookScope) return null;
    const parsed = canonicalizeHoidChapterEvidenceScope(record.chapterScope, bookScope);
    if (!parsed) return null;
    chapterScope = parsed;
  }

  let conversationContext: HoidExactConversationSelectionContext | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "conversationContext")) {
    const parsed = canonicalConversationContext(record.conversationContext);
    if (!parsed) return null;
    const requestEntityIds = entityIds ?? Object.freeze([]);
    if (parsed.entityIds.length !== requestEntityIds.length ||
      !parsed.entityIds.every((id, index) => id === requestEntityIds[index])) return null;
    if (parsed.bookIds.length > 0 &&
      (!bookScope || !parsed.bookIds.every(id => bookScope!.bookIds.includes(id)))) return null;
    conversationContext = parsed;
  }
  return Object.freeze({
    question,
    intent: record.intent as CanonicalRequest["intent"],
    depth,
    ...(entityIds ? { entityIds } : {}),
    ...(bookScope ? { bookScope } : {}),
    ...(chapterScope ? { chapterScope } : {}),
    ...(conversationContext ? { conversationContext } : {}),
  });
}

function canonicalPackage(value: unknown): CanonicalPackage | null {
  const record = exactRecord(value, PACKAGE_KEYS, ["claim", "evidence", "policies"]);
  if (!record) return null;
  const rawEvidence = denseArray(record.evidence, 1, MAX_EVIDENCE_PER_CLAIM);
  const rawPolicies = denseArray(record.policies, 1, MAX_EVIDENCE_PER_CLAIM);
  if (!rawEvidence || !rawPolicies) return null;

  const evidence: HoidExactEvidenceRecord[] = [];
  const evidenceIds = new Set<string>();
  for (const raw of rawEvidence) {
    const item = canonicalEvidence(raw);
    if (!item || evidenceIds.has(item.id)) return null;
    evidenceIds.add(item.id);
    evidence.push(item);
  }
  evidence.sort((left, right) => left.id.localeCompare(right.id));

  const policies: HoidExactUnitEvidencePolicy[] = [];
  const policyIds = new Set<string>();
  for (const raw of rawPolicies) {
    const policy = canonicalizeHoidExactUnitEvidencePolicy(raw);
    if (!policy || policyIds.has(policy.evidenceId)) return null;
    policyIds.add(policy.evidenceId);
    policies.push(policy);
  }
  policies.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

  const attestation = validateHoidExactApprovedClaimAttestation(record.claim, evidence, policies);
  if (attestation.status !== "valid") return null;
  return Object.freeze({
    claim: attestation.claim,
    evidence: Object.freeze(evidence),
    policies: Object.freeze(policies),
  });
}

function canonicalPackages(value: unknown): readonly CanonicalPackage[] | null {
  const raw = denseArray(value, 1, MAX_PACKAGES);
  if (!raw) return null;
  const packages: CanonicalPackage[] = [];
  const claimIds = new Set<string>();
  const evidenceById = new Map<string, string>();
  const policyById = new Map<string, string>();

  for (const item of raw) {
    const canonical = canonicalPackage(item);
    if (!canonical || claimIds.has(canonical.claim.id)) return null;
    claimIds.add(canonical.claim.id);

    for (const evidence of canonical.evidence) {
      const fingerprint = JSON.stringify(evidence);
      const previous = evidenceById.get(evidence.id);
      if (previous !== undefined && previous !== fingerprint) return null;
      evidenceById.set(evidence.id, fingerprint);
    }
    for (const policy of canonical.policies) {
      const fingerprint = JSON.stringify(policy);
      const previous = policyById.get(policy.evidenceId);
      if (previous !== undefined && previous !== fingerprint) return null;
      policyById.set(policy.evidenceId, fingerprint);
    }
    packages.push(canonical);
  }

  packages.sort((left, right) => left.claim.id.localeCompare(right.claim.id));
  return Object.freeze(packages);
}

function normalizeForMatch(value: string): string {
  return value.normalize("NFKD").replace(/[\p{Cf}\p{Mn}]/gu, "").toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function containsAlias(question: string, alias: string): boolean {
  const normalizedQuestion = normalizeForMatch(question);
  const normalizedAlias = escapeRegex(normalizeForMatch(alias));
  return new RegExp("(^|[^\\p{L}\\p{N}])" + normalizedAlias + "($|[^\\p{L}\\p{N}])", "u")
    .test(normalizedQuestion);
}

function snapshotFingerprint(snapshot: HoidUnitProgressSnapshot): string {
  return sha256Hex(JSON.stringify(snapshot));
}

function canonicalSelectionResponse(
  value: unknown,
  request: HoidExactClaimSelectionRequest,
  maximumClaims: number,
): readonly string[] | null {
  const record = exactRecord(value, RESPONSE_KEYS, ["schemaVersion", "requestFingerprint", "claimIds"]);
  if (
    !record ||
    record.schemaVersion !== request.schemaVersion ||
    typeof record.requestFingerprint !== "string" ||
    !SHA_PATTERN.test(record.requestFingerprint) ||
    record.requestFingerprint !== request.requestFingerprint
  ) return null;
  const ids = canonicalIds(record.claimIds, maximumClaims);
  if (!ids) return null;
  const allowed = new Set(request.candidates.map(candidate => candidate.id));
  if (!ids.every(id => allowed.has(id))) return null;
  return ids;
}

function policyBookIds(policy: HoidExactUnitEvidencePolicy): readonly string[] {
  return Object.freeze([...new Set([
    policy.source.bookId,
    policy.firstSafeAppearance.bookId,
    policy.unlock.bookId,
  ])].sort());
}

function sameChapterIdentity(
  left: HoidChapterReference,
  right: HoidChapterReference,
): boolean {
  return left.bookId === right.bookId &&
    left.unitId === right.unitId &&
    left.ordinal === right.ordinal &&
    left.chapterNumber === right.chapterNumber &&
    left.identityFingerprint === right.identityFingerprint;
}

function unavailable(
  reason: Extract<HoidExactEvidenceRuntimeResult, { status: "unavailable" }>["reason"],
): HoidExactEvidenceRuntimeResult {
  return Object.freeze({ status: "unavailable", reason });
}

export class HoidExactUnitEvidenceRuntime {
  private constructor(
    private readonly coordinator: HoidUnitProgressCoordinator,
    private readonly packages: readonly CanonicalPackage[],
    private readonly selector: HoidExactClaimSelector | null,
    private readonly providerTimeoutMs: number,
    private readonly packageByClaimId: ReadonlyMap<string, CanonicalPackage>,
    private readonly policyByEvidenceId: ReadonlyMap<string, HoidExactUnitEvidencePolicy>,
  ) {}

  static create(configInput: unknown): HoidExactUnitEvidenceRuntime | null {
    const record = exactRecord(
      configInput,
      new Set(["coordinator", "packages", "selector", "providerTimeoutMs"]),
      ["coordinator", "packages"],
    );
    if (
      !record ||
      !(record.coordinator instanceof HoidUnitProgressCoordinator)
    ) return null;

    const packages = canonicalPackages(record.packages);
    if (!packages) return null;

    let selector: HoidExactClaimSelector | null = null;
    if (Object.prototype.hasOwnProperty.call(record, "selector")) {
      if (record.selector === null) selector = null;
      else if (hasCallableMethod(record.selector, "selectClaims")) {
        selector = record.selector as HoidExactClaimSelector;
      } else return null;
    }

    const providerTimeoutMs = record.providerTimeoutMs === undefined
      ? DEFAULT_TIMEOUT_MS
      : record.providerTimeoutMs;
    if (
      typeof providerTimeoutMs !== "number" ||
      !Number.isSafeInteger(providerTimeoutMs) ||
      providerTimeoutMs < 1 ||
      providerTimeoutMs > MAX_TIMEOUT_MS
    ) return null;

    const packageByClaimId = new Map<string, CanonicalPackage>();
    const policyByEvidenceId = new Map<string, HoidExactUnitEvidencePolicy>();
    for (const item of packages) {
      packageByClaimId.set(item.claim.id, item);
      for (const policy of item.policies) policyByEvidenceId.set(policy.evidenceId, policy);
    }

    return new HoidExactUnitEvidenceRuntime(
      record.coordinator,
      packages,
      selector,
      providerTimeoutMs,
      packageByClaimId,
      policyByEvidenceId,
    );
  }

  subscribe(listener: () => void): () => void {
    return this.coordinator.subscribe(listener);
  }

  private async readSnapshot(): Promise<Readonly<{
    snapshot: HoidUnitProgressSnapshot;
    fingerprint: string;
  }> | null> {
    const refreshed = await this.coordinator.refresh();
    if (refreshed.status !== "ready") return null;
    const validation = validateHoidUnitProgressSnapshot(refreshed.snapshot);
    if (validation.status !== "valid") return null;
    return Object.freeze({
      snapshot: validation.snapshot,
      fingerprint: snapshotFingerprint(validation.snapshot),
    });
  }

  private lockedMention(
    question: string,
    entityIds: readonly string[] | undefined,
    snapshot: HoidUnitProgressSnapshot,
  ): boolean {
    for (const item of this.packages) {
      const policyById = new Map(item.policies.map(policy => [policy.evidenceId, policy]));
      for (const evidence of item.evidence) {
        const policy = policyById.get(evidence.id);
        if (!policy) continue;
        const explicitlyRequested = entityIds?.includes(evidence.id) ?? false;
        const mentioned = explicitlyRequested || evidence.aliases.some(alias => containsAlias(question, alias));
        if (!mentioned) continue;
        if (authorizeHoidExactUnitEvidence(snapshot, policy).status !== "authorized") return true;
      }
    }
    return false;
  }

  async answer(
    requestInput: unknown,
    options: HoidExactRuntimeCallOptions = {},
  ): Promise<HoidExactEvidenceRuntimeResult> {
    const request = canonicalRequest(requestInput);
    if (!request) return unavailable("invalid-request");
    if (!this.selector) return unavailable("selector-unavailable");

    const initial = await this.readSnapshot();
    if (!initial) return unavailable("progress-unavailable");

    if (this.lockedMention(request.question, request.entityIds, initial.snapshot)) {
      return unavailable("evidence-locked");
    }

    const budget = resolveHoidExplanationDepthBudget(request.depth);
    if (!budget) return unavailable("invalid-request");

    const candidates: HoidExactClaimSelectionCandidate[] = [];
    const candidatePackages = new Map<string, CanonicalPackage>();
    for (const item of this.packages) {
      if (item.claim.intent !== request.intent) continue;
      if (
        request.entityIds &&
        (!item.claim.entityIds || !request.entityIds.every(id => item.claim.entityIds!.includes(id)))
      ) continue;

      const allBookIds = [...new Set(item.policies.flatMap(policy => policyBookIds(policy)))].sort();
      if (!claimEvidenceMatchesHoidBookScope(allBookIds, request.bookScope)) continue;

      // A follow-up may narrow retrieval to chapters cited by the prior answer.
      // Every evidence source for the claim must be inside that exact scope;
      // first-appearance and unlock references remain independent authorization
      // prerequisites and are still checked below.
      if (request.chapterScope && !item.policies.every(policy =>
        request.chapterScope!.some(reference => sameChapterIdentity(policy.source, reference))
      )) continue;

      const authorized = item.policies.every(policy =>
        authorizeHoidExactUnitEvidence(initial.snapshot, policy).status === "authorized"
      );
      if (!authorized) continue;

      candidates.push(Object.freeze({
        id: item.claim.id,
        text: item.claim.text,
        evidenceIds: Object.freeze([...item.claim.evidenceIds]),
      }));
      candidatePackages.set(item.claim.id, item);
    }

    candidates.sort((left, right) => left.id.localeCompare(right.id));
    if (candidates.length === 0) return unavailable("no-authorized-claims");
    if (candidates.length > MAX_CANDIDATES) return unavailable("too-many-candidates");

    const selectionSchemaVersion = request.conversationContext ? 3 : 2;
    const requestFingerprint = sha256Hex(JSON.stringify({
      protocol: selectionSchemaVersion === 3 ? "hoid.exact-claim-selection.v3" : "hoid.exact-claim-selection.v2",
      schemaVersion: selectionSchemaVersion,
      question: request.question,
      intent: request.intent,
      depth: request.depth,
      bookScope: request.bookScope
        ? { mode: request.bookScope.mode, bookIds: [...request.bookScope.bookIds] }
        : null,
      ...(request.conversationContext ? { conversationContext: request.conversationContext } : {}),
      selectionBudget: budget,
      candidates: candidates.map(candidate => ({
        id: candidate.id,
        text: candidate.text,
        evidenceIds: [...candidate.evidenceIds],
      })),
    }));
    const selectionRequest: HoidExactClaimSelectionRequest = Object.freeze({
      schemaVersion: selectionSchemaVersion,
      requestFingerprint,
      question: request.question,
      intent: request.intent,
      candidates: Object.freeze(candidates),
      selectionBudget: budget,
      ...(request.conversationContext ? { conversationContext: request.conversationContext } : {}),
    });

    const controller = new AbortController();
    let progressInvalidated = false;
    const onCallerAbort = () => controller.abort();
    if (options.signal?.aborted) return unavailable("cancelled");
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const unsubscribe = this.coordinator.subscribe(() => {
      progressInvalidated = true;
      controller.abort();
    });

    try {
      const beforeProvider = await this.readSnapshot();
      if (!beforeProvider) return unavailable("progress-unavailable");
      if (
        beforeProvider.snapshot.revision !== initial.snapshot.revision ||
        beforeProvider.fingerprint !== initial.fingerprint
      ) return unavailable("progress-changed");

      const outcome = await invokeWithProviderDeadline(
        signal => this.selector!.selectClaims(selectionRequest, Object.freeze({ signal })),
        this.providerTimeoutMs,
        controller.signal,
      );
      if (outcome.status === "aborted") {
        return unavailable(progressInvalidated ? "progress-changed" : "cancelled");
      }
      if (outcome.status === "timeout") return unavailable("provider-timeout");
      if (outcome.status === "failed") return unavailable("provider-failed");

      const fresh = await this.readSnapshot();
      if (!fresh) return unavailable("progress-unavailable");
      if (
        fresh.snapshot.revision !== initial.snapshot.revision ||
        fresh.fingerprint !== initial.fingerprint
      ) return unavailable("progress-changed");

      const selectedIds = canonicalSelectionResponse(
        outcome.value,
        selectionRequest,
        Math.min(budget.maxClaims, MAX_SELECTED_CLAIMS),
      );
      if (!selectedIds) return unavailable("invalid-selection");

      const selectedPackages = selectedIds
        .map(id => candidatePackages.get(id))
        .filter((item): item is CanonicalPackage => item !== undefined);
      if (selectedPackages.length !== selectedIds.length) return unavailable("invalid-selection");

      const selectedBookIds = selectedPackages.flatMap(item =>
        item.policies.flatMap(policy => policyBookIds(policy))
      );
      if (!selectedEvidenceSatisfiesHoidBookScope(selectedBookIds, request.bookScope)) {
        return unavailable("invalid-selection");
      }

      const selectedEvidenceIds = [...new Set(selectedPackages.flatMap(item => [...item.claim.evidenceIds]))].sort();
      const selectedWorks = new Set(selectedBookIds);
      const characterCount = selectedPackages.reduce((total, item) => total + item.claim.text.length, 0);
      if (
        selectedPackages.length > budget.maxClaims ||
        selectedEvidenceIds.length > budget.maxEvidence ||
        selectedWorks.size > budget.maxWorks ||
        characterCount > budget.maxCharacters
      ) return unavailable("depth-budget-exceeded");

      if (
        budget.requireCrossWorkSegment &&
        !selectedPackages.some(item => new Set(item.policies.flatMap(policy => policyBookIds(policy))).size >= 2)
      ) return unavailable("comparison-provenance-required");

      for (const item of selectedPackages) {
        for (const policy of item.policies) {
          if (authorizeHoidExactUnitEvidence(fresh.snapshot, policy).status !== "authorized") {
            return unavailable("evidence-locked");
          }
        }
      }

      const citationById = new Map<string, HoidExactEvidenceCitation>();
      const segments: HoidExactEvidenceAnswerSegment[] = selectedPackages.map(item => {
        const sources = item.policies.map(policy => {
          const citation = Object.freeze({
            evidenceId: policy.evidenceId,
            source: policy.source,
            firstSafeAppearance: policy.firstSafeAppearance,
            unlock: policy.unlock,
          });
          citationById.set(policy.evidenceId, citation);
          return citation;
        });
        return Object.freeze({
          claimId: item.claim.id,
          text: item.claim.text,
          evidenceIds: Object.freeze([...item.claim.evidenceIds]),
          sources: Object.freeze(sources),
        });
      });

      const sources = [...citationById.values()].sort((left, right) =>
        left.evidenceId.localeCompare(right.evidenceId)
      );
      const answer: HoidExactEvidenceAnswer = Object.freeze({
        text: segments.map(segment => segment.text).join("\n\n"),
        claimIds: Object.freeze(selectedPackages.map(item => item.claim.id)),
        evidenceIds: Object.freeze(selectedEvidenceIds),
        entityIds: Object.freeze([...new Set(selectedPackages.flatMap(item => [...(item.claim.entityIds ?? [])]))].sort()),
        sources: Object.freeze(sources),
        segments: Object.freeze(segments),
        layout: segments.length > 1 ? "grouped" : "plain",
      });
      return Object.freeze({
        status: "ready",
        answer,
        progressRevision: fresh.snapshot.revision,
        progressFingerprint: fresh.fingerprint,
      });
    } finally {
      unsubscribe();
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  async verifyForPresentation(receiptInput: unknown): Promise<HoidExactPresentationVerification> {
    const record = exactRecord(receiptInput, RECEIPT_KEYS, [
      "progressRevision", "progressFingerprint", "evidenceIds",
    ]);
    if (
      !record ||
      typeof record.progressRevision !== "number" ||
      !Number.isSafeInteger(record.progressRevision) ||
      record.progressRevision < 0 ||
      typeof record.progressFingerprint !== "string" ||
      !SHA_PATTERN.test(record.progressFingerprint)
    ) return Object.freeze({ status: "unavailable", reason: "invalid-receipt" });

    const evidenceIds = canonicalIds(record.evidenceIds, MAX_EVIDENCE_PER_CLAIM * MAX_PACKAGES);
    if (!evidenceIds) return Object.freeze({ status: "unavailable", reason: "invalid-receipt" });

    const fresh = await this.readSnapshot();
    if (!fresh) return Object.freeze({ status: "unavailable", reason: "progress-unavailable" });
    if (
      fresh.snapshot.revision !== record.progressRevision ||
      fresh.fingerprint !== record.progressFingerprint
    ) return Object.freeze({ status: "unavailable", reason: "progress-changed" });

    for (const evidenceId of evidenceIds) {
      const policy = this.policyByEvidenceId.get(evidenceId);
      if (!policy || authorizeHoidExactUnitEvidence(fresh.snapshot, policy).status !== "authorized") {
        return Object.freeze({ status: "unavailable", reason: "evidence-locked" });
      }
    }
    return Object.freeze({
      status: "ready",
      progressRevision: fresh.snapshot.revision,
      progressFingerprint: fresh.fingerprint,
    });
  }
}

export function createHoidExactUnitEvidenceRuntime(
  config: unknown,
): HoidExactUnitEvidenceRuntime | null {
  return HoidExactUnitEvidenceRuntime.create(config);
}

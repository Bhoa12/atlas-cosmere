import {
  validateHoidEditorialClaimDraft,
  type HoidEditorialClaimDraft,
  type HoidEditorialClaimEvidence,
} from "./editorialClaimDrafts";
import { validateHoidEditorialClaimReviewReceipt } from "./editorialClaimReviewPackets";
import {
  validateHoidEditorialReviewKit,
  type HoidEditorialReviewKit,
} from "./editorialReviewKit";
import {
  validateHoidExactApprovedClaimAttestation,
  type HoidExactEvidenceRecord,
} from "./exactUnitClaimIntegrity";
import {
  canonicalizeHoidExactUnitEvidencePolicy,
  type HoidExactUnitEvidencePolicy,
} from "./unitEvidenceAuthorizationV2";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import {
  authorizeHoidTrustedHostSignedEditorialBundlePromotion,
  type HoidTrustedHostPromotionInput,
  type HoidTrustedHostPromotionResult,
} from "./trustedHostPromotionAuthority";

const MAX_CLAIM_BINDINGS = 512;
const MAX_EVIDENCE_PER_CLAIM = 8;
const SOURCE_CHECK_TIMEOUT_MS = 8_000;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

export type HoidEditorialSourceDocumentAccessRequest = Readonly<{
  bookId: string;
  editionId: string;
  navigationSha256: string;
  chapterNumber: number;
  locatorId: string;
  expectedDocumentSha256: string;
}>;

export type HoidEditorialSourceDocumentAccessPort = Readonly<{
  /**
   * Host-local availability check. It returns only a digest and must never
   * return EPUB bytes, XHTML, extracted text, titles or private file paths.
   */
  inspectChapter(
    request: HoidEditorialSourceDocumentAccessRequest,
    options: Readonly<{ signal: AbortSignal }>,
  ): Promise<unknown>;
}>;

export type HoidEditorialClaimEvidenceBinding = Readonly<{
  draftEvidenceIndex: number;
  evidenceId: string;
}>;

export type HoidEditorialClaimPromotionBinding = Readonly<{
  approvedClaim: unknown;
  evidence: readonly unknown[];
  policies: readonly unknown[];
  evidenceBindings: readonly HoidEditorialClaimEvidenceBinding[];
  subjectEvidenceId: string;
}>;

export type HoidEditorialClaimPromotionPreflightResult =
  | Readonly<{
      status: "ready-for-trusted-host";
      reviewKitFingerprint: string;
      promotionPlanFingerprint: string;
      atomicClaimCount: number;
      sourceDocumentsVerified: number;
      assertionKindCounts: Readonly<Record<string, number>>;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-input"
        | "invalid-review-kit"
        | "trusted-host-context-mismatch"
        | "claim-binding-coverage-mismatch"
        | "invalid-claim-binding"
        | "claim-not-in-review-kit"
        | "review-not-approved"
        | "review-packet-mismatch"
        | "approved-claim-invalid"
        | "unclassified-approved-claim"
        | "epistemic-classification-mismatch"
        | "subject-binding-mismatch"
        | "evidence-binding-mismatch"
        | "source-not-registered"
        | "source-unavailable"
        | "source-digest-mismatch"
        | "source-access-timeout"
        | "source-access-failed"
        | "source-access-port-invalid";
      claimId?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidTrustedHostClaimPromotionResult =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      authorization: Extract<HoidTrustedHostPromotionResult, { status: "ready-for-maintainer-commit" }>;
      parityAudit: Extract<HoidEditorialClaimPromotionPreflightResult, { status: "ready-for-trusted-host" }>;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "claim-parity-preflight-blocked"
        | "trusted-host-context-mismatch"
        | "trusted-host-blocked"
        | "trusted-host-failed";
      parityAudit?: HoidEditorialClaimPromotionPreflightResult;
      trustedHostResult?: Extract<HoidTrustedHostPromotionResult, { status: "blocked" }>;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidTrustedHostClaimPromotionInput = Readonly<{
  trustedHostInput: HoidTrustedHostPromotionInput;
  reviewKit: unknown;
  claimBindings: readonly unknown[];
}>;

export type HoidTrustedHostClaimPromotionAdapter = Readonly<{
  authorize(input: unknown): Promise<HoidTrustedHostClaimPromotionResult>;
}>;

type CanonicalBinding = Readonly<{
  approvedClaim: unknown;
  evidence: readonly unknown[];
  policies: readonly unknown[];
  evidenceBindings: readonly HoidEditorialClaimEvidenceBinding[];
  subjectEvidenceId: string;
}>;

type SourceInspection =
  | Readonly<{ status: "available"; documentSha256: string }>
  | Readonly<{ status: "unavailable"; reason: string }>
  | Readonly<{ status: "timeout" | "failed" | "invalid" }>;

function blocked(
  reason: Extract<HoidEditorialClaimPromotionPreflightResult, { status: "blocked" }>["reason"],
  claimId?: string,
): Extract<HoidEditorialClaimPromotionPreflightResult, { status: "blocked" }> {
  return Object.freeze({
    status: "blocked",
    reason,
    ...(claimId ? { claimId } : {}),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(output, key))) return null;
    return output;
  } catch {
    return null;
  }
}

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor &&
      Object.prototype.hasOwnProperty.call(descriptor, "value") &&
      descriptor.enumerable === true
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function ownDataString(value: unknown, key: string): string | null {
  const item = ownDataValue(value, key);
  return typeof item === "string" ? item : null;
}

function denseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output.push(descriptor.value);
    }
    return Object.freeze(output);
  } catch {
    return null;
  }
}

function safeMethod<TRequest, TOptions>(
  value: unknown,
  name: string,
): ((request: TRequest, options: TOptions) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (request: TRequest, options: TOptions) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function canonicalBinding(value: unknown): CanonicalBinding | null {
  const raw = exactRecord(value, [
    "approvedClaim", "evidence", "policies", "evidenceBindings", "subjectEvidenceId",
  ]);
  if (!raw) return null;
  const evidence = denseArray(raw.evidence, MAX_EVIDENCE_PER_CLAIM);
  const policies = denseArray(raw.policies, MAX_EVIDENCE_PER_CLAIM);
  const evidenceBindings = denseArray(raw.evidenceBindings, MAX_EVIDENCE_PER_CLAIM);
  const subjectEvidenceId = raw.subjectEvidenceId;
  if (
    !raw.approvedClaim ||
    !evidence ||
    !policies ||
    !evidenceBindings ||
    evidence.length < 1 ||
    evidence.length !== policies.length ||
    evidence.length !== evidenceBindings.length ||
    typeof subjectEvidenceId !== "string" ||
    !ID_PATTERN.test(subjectEvidenceId)
  ) return null;

  const canonicalEvidenceBindings: HoidEditorialClaimEvidenceBinding[] = [];
  const seenIndexes = new Set<number>();
  const seenIds = new Set<string>();
  for (const item of evidenceBindings) {
    const entry = exactRecord(item, ["draftEvidenceIndex", "evidenceId"]);
    if (
      !entry ||
      typeof entry.draftEvidenceIndex !== "number" ||
      !Number.isSafeInteger(entry.draftEvidenceIndex) ||
      entry.draftEvidenceIndex < 0 ||
      typeof entry.evidenceId !== "string" ||
      !ID_PATTERN.test(entry.evidenceId) ||
      seenIndexes.has(entry.draftEvidenceIndex) ||
      seenIds.has(entry.evidenceId)
    ) return null;
    seenIndexes.add(entry.draftEvidenceIndex);
    seenIds.add(entry.evidenceId);
    canonicalEvidenceBindings.push(Object.freeze({
      draftEvidenceIndex: entry.draftEvidenceIndex,
      evidenceId: entry.evidenceId,
    }));
  }

  return Object.freeze({
    approvedClaim: raw.approvedClaim,
    evidence,
    policies,
    evidenceBindings: Object.freeze(canonicalEvidenceBindings),
    subjectEvidenceId,
  });
}

function isPlainJsonData(value: unknown, ancestors: Set<object> = new Set()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return false;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || !keys.includes("length")) return false;
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true || !isPlainJsonData(descriptor.value, ancestors)) return false;
      }
      return true;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true || !isPlainJsonData(descriptor.value, ancestors)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return isPlainJsonData(left) && isPlainJsonData(right) &&
      JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function trustedHostInputMatchesKit(
  input: HoidTrustedHostPromotionInput,
  kit: HoidEditorialReviewKit,
): boolean {
  const plan = ownDataValue(input, "plan");
  const context = exactRecord(ownDataValue(input, "context"), [
    "reviewManifest", "knowledgeManifest", "source", "receipts",
  ]);
  const request = ownDataValue(input, "request");
  const requestRepository = ownDataString(request, "repositoryFullName");
  const expectedRepository = ownDataString(input, "expectedRepositoryFullName");

  return Boolean(
    sameJson(plan, kit.promotionPlan) &&
    context &&
    sameJson(context.reviewManifest, kit.reviewManifest) &&
    sameJson(context.knowledgeManifest, kit.knowledgeManifest) &&
    sameJson(context.source, kit.sourceInput) &&
    sameJson(context.receipts, kit.receipts) &&
    requestRepository === kit.context.repositoryFullName &&
    expectedRepository === kit.context.repositoryFullName &&
    ownDataValue(request, "pullRequestNumber") === kit.context.pullRequestNumber &&
    ownDataValue(request, "expectedBaseRef") === kit.context.baseRef &&
    ownDataValue(request, "expectedBaseSha") === kit.context.baseSha &&
    ownDataValue(request, "expectedHeadRef") === kit.context.headRef &&
    ownDataValue(request, "expectedHeadSha") === kit.context.headSha &&
    ownDataValue(request, "promotionManifestPath") === kit.context.promotionManifestPath
  );
}

function uniqueByDraftId(values: readonly unknown[], draftId: string): unknown | null {
  const matches = values.filter(value => ownDataString(value, "draftId") === draftId);
  return matches.length === 1 ? matches[0] : null;
}

function manifestUnitMatches(
  bookId: string,
  unitId: string,
  ordinal: number,
  chapterNumber: number,
): boolean {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") return false;
  const matches = result.manifest.units.filter(unit =>
    unit.id === unitId &&
    unit.ordinal === ordinal &&
    unit.chapterNumber === chapterNumber
  );
  return matches.length === 1;
}

async function inspectWithDeadline(
  inspect: (
    request: HoidEditorialSourceDocumentAccessRequest,
    options: Readonly<{ signal: AbortSignal }>,
  ) => Promise<unknown>,
  request: HoidEditorialSourceDocumentAccessRequest,
): Promise<SourceInspection> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const operation = Promise.resolve().then(() => inspect(request, Object.freeze({ signal: controller.signal })));
  const timeout = new Promise<SourceInspection>(resolve => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve(Object.freeze({ status: "timeout" }));
    }, SOURCE_CHECK_TIMEOUT_MS);
  });
  const settled = operation.then(
    value => {
      const status = ownDataValue(value, "status");
      if (status === "unavailable") {
        const raw = exactRecord(value, ["status", "reason"]);
        return raw && typeof raw.reason === "string"
          ? Object.freeze({ status: "unavailable" as const, reason: raw.reason })
          : Object.freeze({ status: "invalid" as const });
      }
      const raw = exactRecord(value, ["status", "documentSha256"]);
      if (
        !raw ||
        raw.status !== "available" ||
        typeof raw.documentSha256 !== "string" ||
        !SHA_PATTERN.test(raw.documentSha256)
      ) return Object.freeze({ status: "invalid" as const });
      return Object.freeze({ status: "available" as const, documentSha256: raw.documentSha256 });
    },
    () => Object.freeze({ status: "failed" as const }),
  );
  try {
    return await Promise.race([settled, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function verifyDraftEvidenceSources(
  draft: HoidEditorialClaimDraft,
  binding: CanonicalBinding,
  policiesById: ReadonlyMap<string, HoidExactUnitEvidencePolicy>,
  inspect: (
    request: HoidEditorialSourceDocumentAccessRequest,
    options: Readonly<{ signal: AbortSignal }>,
  ) => Promise<unknown>,
  cache: Map<string, string>,
): Promise<Extract<HoidEditorialClaimPromotionPreflightResult, { status: "blocked" }> | number> {
  let verified = 0;
  const byIndex = new Map(binding.evidenceBindings.map(item => [item.draftEvidenceIndex, item.evidenceId]));
  if (
    binding.evidenceBindings.length !== draft.evidence.length ||
    byIndex.size !== draft.evidence.length ||
    !draft.evidence.every((_, index) => byIndex.has(index))
  ) return blocked("evidence-binding-mismatch", draft.id);

  for (let index = 0; index < draft.evidence.length; index += 1) {
    const sourceEvidence: HoidEditorialClaimEvidence = draft.evidence[index];
    const evidenceId = byIndex.get(index);
    if (!evidenceId) return blocked("evidence-binding-mismatch", draft.id);
    const policy = policiesById.get(evidenceId);
    if (!policy) return blocked("evidence-binding-mismatch", draft.id);

    const manifestResult = getHoidReadingManifest(sourceEvidence.source.bookId);
    if (manifestResult.status !== "ready") return blocked("source-not-registered", draft.id);
    const manifest = manifestResult.manifest;
    const units = manifest.units.filter(unit =>
      unit.chapterNumber === sourceEvidence.source.chapter &&
      unit.locatorId === sourceEvidence.source.locatorId
    );
    if (units.length !== 1) return blocked("source-not-registered", draft.id);
    const unit = units[0];

    const expectedDigest = getVerifiedChapterDocumentSha256(
      sourceEvidence.source.bookId,
      manifest.editionId,
      manifest.navigationSha256,
      sourceEvidence.source.chapter,
    );
    if (
      manifest.editionId !== sourceEvidence.sourceIntegrity.editionId ||
      manifest.navigationSha256 !== sourceEvidence.sourceIntegrity.navigationSha256 ||
      !expectedDigest ||
      expectedDigest !== sourceEvidence.sourceIntegrity.documentSha256 ||
      policy.source.bookId !== sourceEvidence.source.bookId ||
      policy.source.unitId !== unit.id ||
      policy.source.ordinal !== unit.ordinal ||
      policy.source.chapterNumber !== sourceEvidence.source.chapter ||
      policy.unlock.bookId !== sourceEvidence.unlock.bookId ||
      policy.unlock.chapterNumber !== sourceEvidence.unlock.chapter ||
      !manifestUnitMatches(
        policy.unlock.bookId,
        policy.unlock.unitId,
        policy.unlock.ordinal,
        policy.unlock.chapterNumber,
      ) ||
      !manifestUnitMatches(
        policy.firstSafeAppearance.bookId,
        policy.firstSafeAppearance.unitId,
        policy.firstSafeAppearance.ordinal,
        policy.firstSafeAppearance.chapterNumber,
      )
    ) return blocked("evidence-binding-mismatch", draft.id);

    const cacheKey = [
      sourceEvidence.source.bookId,
      String(sourceEvidence.source.chapter),
      expectedDigest,
    ].join(":");
    if (cache.has(cacheKey)) {
      verified += 1;
      continue;
    }

    const inspection = await inspectWithDeadline(inspect, Object.freeze({
      bookId: sourceEvidence.source.bookId,
      editionId: manifest.editionId,
      navigationSha256: manifest.navigationSha256,
      chapterNumber: sourceEvidence.source.chapter,
      locatorId: sourceEvidence.source.locatorId,
      expectedDocumentSha256: expectedDigest,
    }));
    if (inspection.status === "timeout") return blocked("source-access-timeout", draft.id);
    if (inspection.status === "failed" || inspection.status === "invalid") {
      return blocked("source-access-failed", draft.id);
    }
    if (inspection.status === "unavailable") return blocked("source-unavailable", draft.id);
    if (inspection.documentSha256 !== expectedDigest) return blocked("source-digest-mismatch", draft.id);

    cache.set(cacheKey, expectedDigest);
    verified += 1;
  }
  return verified;
}

/**
 * Audits every atomic claim in a validated review kit against its exact-unit
 * approved counterpart. The result is a non-promoting preflight only.
 *
 * A successful source inspection proves that the local host can read the
 * edition-bound chapter document and that its digest matches the sparse
 * inspected-document allowlist. It does not prove that a reviewer consulted
 * the passage; the signed review and protected GitHub process still do that.
 */
export async function auditHoidEditorialClaimPromotionPreflight(
  reviewKitInput: unknown,
  bindingsInput: unknown,
  sourceAccessPortInput: unknown,
): Promise<HoidEditorialClaimPromotionPreflightResult> {
  const kitValidation = validateHoidEditorialReviewKit(reviewKitInput);
  if (kitValidation.status !== "valid") return blocked("invalid-review-kit");
  const kit = kitValidation.kit;
  const rawBindings = denseArray(bindingsInput, MAX_CLAIM_BINDINGS);
  if (!rawBindings) return blocked("invalid-input");

  const drafts = kit.sourceInput.claims;
  const draftIds = drafts.map(value => ownDataString(value, "id"));
  if (draftIds.some(id => !id)) return blocked("invalid-review-kit");
  const bindings: CanonicalBinding[] = [];
  const bindingIds = new Set<string>();

  for (const raw of rawBindings) {
    const binding = canonicalBinding(raw);
    if (!binding) return blocked("invalid-claim-binding");
    const claimId = ownDataString(binding.approvedClaim, "id");
    if (!claimId || bindingIds.has(claimId)) return blocked("claim-binding-coverage-mismatch");
    bindingIds.add(claimId);
    bindings.push(binding);
  }

  const expectedIds = draftIds.map(id => id as string).sort();
  const suppliedIds = [...bindingIds].sort();
  if (expectedIds.length !== suppliedIds.length || expectedIds.some((id, index) => id !== suppliedIds[index])) {
    return blocked("claim-binding-coverage-mismatch");
  }

  const inspect = safeMethod<
    HoidEditorialSourceDocumentAccessRequest,
    Readonly<{ signal: AbortSignal }>
  >(sourceAccessPortInput, "inspectChapter");
  if (!inspect) return blocked("source-access-port-invalid");

  const packetList = kit.packets.claims as readonly unknown[];
  const receiptList = kit.receipts.claims as readonly unknown[];
  const sourceCache = new Map<string, string>();
  const assertionKindCounts: Record<string, number> = Object.create(null) as Record<string, number>;
  let sourceDocumentsVerified = 0;

  for (const binding of bindings) {
    const claimId = ownDataString(binding.approvedClaim, "id");
    if (!claimId) return blocked("invalid-claim-binding");
    const draftInput = drafts.find(value => ownDataString(value, "id") === claimId);
    if (!draftInput) return blocked("claim-not-in-review-kit");
    const draftResult = validateHoidEditorialClaimDraft(draftInput);
    if (draftResult.status !== "valid") return blocked("invalid-review-kit", claimId);
    const draft = draftResult.draft;

    const packet = uniqueByDraftId(packetList, claimId);
    const receipt = uniqueByDraftId(receiptList, claimId);
    if (!packet || !receipt) return blocked("review-packet-mismatch", claimId);
    if (
      ownDataValue(packet, "assertionKind") !== draft.assertionKind ||
      ownDataValue(packet, "statement") !== draft.statement ||
      ownDataValue(packet, "subjectId") !== draft.subjectId ||
      ownDataValue(packet, "subjectKind") !== draft.subjectKind ||
      ownDataValue(packet, "intent") !== draft.intent ||
      ownDataValue(packet, "claimSha256") !== draft.integrity.claimSha256
    ) return blocked("review-packet-mismatch", claimId);

    const receiptResult = validateHoidEditorialClaimReviewReceipt(packet, receipt);
    if (
      receiptResult.status !== "valid" ||
      receiptResult.outcome !== "approved-awaiting-source-promotion"
    ) return blocked("review-not-approved", claimId);

    const approvedResult = validateHoidExactApprovedClaimAttestation(
      binding.approvedClaim,
      binding.evidence,
      binding.policies,
    );
    if (approvedResult.status !== "valid") return blocked("approved-claim-invalid", claimId);
    const approved = approvedResult.claim;

    if (approved.assertionKind === undefined) return blocked("unclassified-approved-claim", claimId);
    if (
      approved.id !== draft.id ||
      approved.text !== draft.statement ||
      approved.intent !== draft.intent ||
      approved.assertionKind !== draft.assertionKind
    ) return blocked("epistemic-classification-mismatch", claimId);

    if (
      binding.subjectEvidenceId !== draft.subjectId ||
      !(approved.entityIds ?? []).includes(binding.subjectEvidenceId)
    ) return blocked("subject-binding-mismatch", claimId);

    const evidenceById = new Map<string, HoidExactEvidenceRecord>();
    for (const raw of binding.evidence) {
      const id = ownDataString(raw, "id");
      if (!id || evidenceById.has(id)) return blocked("evidence-binding-mismatch", claimId);
      evidenceById.set(id, raw as HoidExactEvidenceRecord);
    }
    const policiesById = new Map<string, HoidExactUnitEvidencePolicy>();
    for (const raw of binding.policies) {
      const policy = canonicalizeHoidExactUnitEvidencePolicy(raw);
      if (!policy || policiesById.has(policy.evidenceId)) return blocked("evidence-binding-mismatch", claimId);
      policiesById.set(policy.evidenceId, policy);
    }
    const subjectEvidence = evidenceById.get(binding.subjectEvidenceId);
    if (!subjectEvidence || subjectEvidence.kind !== draft.subjectKind) {
      return blocked("subject-binding-mismatch", claimId);
    }
    const mappedEvidenceIds = binding.evidenceBindings.map(item => item.evidenceId).sort();
    if (
      mappedEvidenceIds.length !== approved.evidenceIds.length ||
      mappedEvidenceIds.some((id, index) => id !== approved.evidenceIds[index]) ||
      mappedEvidenceIds.some(id => !evidenceById.has(id) || !policiesById.has(id))
    ) return blocked("evidence-binding-mismatch", claimId);

    const sourceResult = await verifyDraftEvidenceSources(
      draft,
      binding,
      policiesById,
      inspect,
      sourceCache,
    );
    if (typeof sourceResult !== "number") return sourceResult;
    sourceDocumentsVerified += sourceResult;
    assertionKindCounts[draft.assertionKind] = (assertionKindCounts[draft.assertionKind] ?? 0) + 1;
  }

  return Object.freeze({
    status: "ready-for-trusted-host",
    reviewKitFingerprint: kit.fingerprint,
    promotionPlanFingerprint: kit.promotionPlan.fingerprint,
    atomicClaimCount: drafts.length,
    sourceDocumentsVerified,
    assertionKindCounts: Object.freeze({ ...assertionKindCounts }),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}


/**
 * Composition adapter: the classification/source parity preflight must pass
 * before the existing trusted host checks reviewer quorum, packet signatures,
 * protected GitHub approvals and fresh durable progress. Neither layer writes
 * production data or merges a Pull Request.
 */
export function createHoidTrustedHostClaimPromotionAdapter(
  sourceAccessPort: HoidEditorialSourceDocumentAccessPort,
  authorizeTrustedHost: (
    input: HoidTrustedHostPromotionInput,
  ) => Promise<HoidTrustedHostPromotionResult>,
): HoidTrustedHostClaimPromotionAdapter {
  return Object.freeze({
    async authorize(input: unknown): Promise<HoidTrustedHostClaimPromotionResult> {
      const raw = exactRecord(input, ["trustedHostInput", "reviewKit", "claimBindings"]);
      if (!raw) {
        return Object.freeze({
          status: "blocked",
          reason: "claim-parity-preflight-blocked",
          parityAudit: blocked("invalid-input"),
          promotionAllowed: false,
          productionWritePerformed: false,
        });
      }
      const trustedHostInput = raw.trustedHostInput as HoidTrustedHostPromotionInput;
      const kitValidation = validateHoidEditorialReviewKit(raw.reviewKit);
      if (kitValidation.status !== "valid") {
        return Object.freeze({
          status: "blocked",
          reason: "claim-parity-preflight-blocked",
          parityAudit: blocked("invalid-review-kit"),
          promotionAllowed: false,
          productionWritePerformed: false,
        });
      }
      if (!trustedHostInputMatchesKit(trustedHostInput, kitValidation.kit)) {
        return Object.freeze({
          status: "blocked",
          reason: "trusted-host-context-mismatch",
          parityAudit: blocked("trusted-host-context-mismatch"),
          promotionAllowed: false,
          productionWritePerformed: false,
        });
      }

      const parityAudit = await auditHoidEditorialClaimPromotionPreflight(
        kitValidation.kit,
        raw.claimBindings,
        sourceAccessPort,
      );
      if (parityAudit.status !== "ready-for-trusted-host") {
        return Object.freeze({
          status: "blocked",
          reason: "claim-parity-preflight-blocked",
          parityAudit,
          promotionAllowed: false,
          productionWritePerformed: false,
        });
      }

      try {
        const authorization = await authorizeTrustedHost(trustedHostInput);
        if (authorization.status !== "ready-for-maintainer-commit") {
          return Object.freeze({
            status: "blocked",
            reason: "trusted-host-blocked",
            parityAudit,
            trustedHostResult: authorization,
            promotionAllowed: false,
            productionWritePerformed: false,
          });
        }
        return Object.freeze({
          status: "ready-for-maintainer-commit",
          authorization,
          parityAudit,
          promotionAllowed: false,
          productionWritePerformed: false,
        });
      } catch {
        return Object.freeze({
          status: "blocked",
          reason: "trusted-host-failed",
          parityAudit,
          promotionAllowed: false,
          productionWritePerformed: false,
        });
      }
    },
  });
}

/** Production composition uses the repository's existing trusted-host authority. */
export function createProductionHoidTrustedHostClaimPromotionAdapter(
  sourceAccessPort: HoidEditorialSourceDocumentAccessPort,
): HoidTrustedHostClaimPromotionAdapter {
  return createHoidTrustedHostClaimPromotionAdapter(
    sourceAccessPort,
    authorizeHoidTrustedHostSignedEditorialBundlePromotion,
  );
}

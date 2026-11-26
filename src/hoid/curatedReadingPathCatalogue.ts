import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";
import {
  verifyHoidReviewerBoundPayloadSignatures,
  type HoidApprovedClaimReviewSignatureContext,
  type HoidEd25519VerificationPort,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";
import { verifyHoidExactUnitClaimSignatures } from "./exactUnitClaimSignatures";
import {
  validateHoidUnitProgressCursor,
} from "./unitProgressCursor";
import {
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
} from "./unitProgressLedger";
import { sha256Hex } from "./sha256";

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const MINIMUM_APPROVALS = 2;
const MAXIMUM_APPROVALS = 8;
const MAXIMUM_PATHS = 64;
const MAXIMUM_STEPS = 24;
const MAXIMUM_PREREQUISITES = 24;
const MAXIMUM_EVIDENCE = 16;
const MAXIMUM_RECOMMENDATIONS = 5;

const WORK_BY_ID = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work]));
const BIBLIOGRAPHY_FINGERPRINT = sha256Hex(JSON.stringify(
  HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title, work.sourceGroup]),
));

export type HoidReadingPathPrerequisite = Readonly<{
  stepId: string;
  through: HoidChapterReference;
}>;

export type HoidReadingPathRationaleEvidence = Readonly<{
  /** Exact signed editorial claim whose evidence package supports this rationale. */
  claimId: string;
  evidenceId: string;
  reference: HoidChapterReference;
}>;

export type HoidCuratedReadingPathStep = Readonly<{
  stepId: string;
  workId: string;
  rationale: string;
  prerequisites: readonly HoidReadingPathPrerequisite[];
  rationaleEvidence: readonly HoidReadingPathRationaleEvidence[];
}>;

export type HoidCuratedReadingPath = Readonly<{
  pathId: string;
  title: string;
  description: string;
  steps: readonly HoidCuratedReadingPathStep[];
  fingerprint: string;
}>;

export type HoidCuratedReadingPathCatalogue = Readonly<{
  schemaVersion: 1;
  kind: "hoid-curated-reading-path-catalogue";
  catalogueId: string;
  revision: number;
  paths: readonly HoidCuratedReadingPath[];
  fingerprint: string;
}>;

export type HoidReadingPathCatalogueBuildResult =
  | Readonly<{ status: "ready"; catalogue: HoidCuratedReadingPathCatalogue }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-input"
        | "invalid-catalogue-id"
        | "invalid-revision"
        | "invalid-paths"
        | "invalid-path"
        | "duplicate-path";
    }>;

export type HoidReadingPathCatalogueValidation =
  | Readonly<{ status: "valid"; catalogue: HoidCuratedReadingPathCatalogue }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-shape" | "catalogue-mismatch" | "fingerprint-mismatch";
    }>;

export type HoidReadingPathApprovalAttestation = Readonly<{
  schemaVersion: 1;
  catalogueFingerprint: string;
  reviewerId: string;
  decision: "approve" | "reject";
  reviewedAt: string;
  keyId: string;
  signatureHex: string;
}>;

export type HoidReadingPathApprovalVerification =
  | Readonly<{
      status: "verified";
      catalogueFingerprint: string;
      registryRevision: number;
      reviewerIds: readonly string[];
      keyIds: readonly string[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "rejected";
      catalogueFingerprint: string;
      registryRevision: number;
      reviewerIds: readonly string[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "trust-verification-failed" | "verifier-failed";
      trustReason?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-input"
        | "invalid-catalogue"
        | "empty-catalogue"
        | "invalid-attestations"
        | "invalid-verifier";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidCuratedReadingPathRecommendation = Readonly<{
  pathId: string;
  pathTitle: string;
  pathFingerprint: string;
  stepId: string;
  workId: string;
  workTitle: string;
  rationale: string;
  /** Starting a new work is always a separate, explicit reader action. */
  navigation: "manual-reader-selection-required";
}>;

export type HoidCuratedReadingPathRecommendationPlan = Readonly<{
  schemaVersion: 1;
  kind: "hoid-curated-reading-path-recommendation-plan";
  catalogueFingerprint: string;
  progressRevision: number;
  progressFingerprint: string;
  registryRevision: number;
  /** Digest of the signed exact-unit claim packages that support route rationales. */
  rationaleEvidenceFingerprint: string;
  recommendations: readonly HoidCuratedReadingPathRecommendation[];
  fingerprint: string;
}>;

export type HoidCuratedReadingPathEvaluation =
  | Readonly<{
      status: "ready";
      plan: HoidCuratedReadingPathRecommendationPlan;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "no-curated-paths";
      catalogueFingerprint: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "no-eligible-next-work";
      reason: "all-paths-completed" | "prerequisites-incomplete" | "path-step-in-progress";
      catalogueFingerprint: string;
      progressRevision: number;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "approval-required" | "approval-rejected" | "progress-invalid" | "evidence-unverified";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-input" | "invalid-catalogue" | "invalid-progress" | "invalid-approval";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidCuratedReadingPathPlanValidation =
  | Readonly<{ status: "valid"; plan: HoidCuratedReadingPathRecommendationPlan }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-input" | "invalid-plan" | "stale-or-tampered-plan" | "current-plan-unavailable";
    }>;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
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

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    value === value.trim() && ID_PATTERN.test(value);
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  try {
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

function referenceValue(reference: HoidChapterReference): readonly unknown[] {
  return [
    reference.schemaVersion,
    reference.kind,
    reference.authority,
    reference.bookId,
    reference.chapterNumber,
    reference.ordinal,
    reference.unitId,
    reference.labelAmbiguous,
    reference.identityFingerprint,
  ];
}

function pathFingerprint(
  path: Omit<HoidCuratedReadingPath, "fingerprint">,
): string {
  return sha256Hex(JSON.stringify([
    "hoid-curated-reading-path-v1",
    path.pathId,
    path.title,
    path.description,
    path.steps.map(step => [
      step.stepId,
      step.workId,
      step.rationale,
      step.prerequisites.map(item => [item.stepId, referenceValue(item.through)]),
      step.rationaleEvidence.map(item => [item.claimId, item.evidenceId, referenceValue(item.reference)]),
    ]),
  ]));
}

function catalogueFingerprint(
  catalogueId: string,
  revision: number,
  paths: readonly HoidCuratedReadingPath[],
): string {
  return sha256Hex(JSON.stringify([
    "hoid-curated-reading-path-catalogue-v1",
    BIBLIOGRAPHY_FINGERPRINT,
    catalogueId,
    revision,
    paths.map(path => [path.pathId, path.fingerprint]),
  ]));
}

function canonicalReference(value: unknown): HoidChapterReference | null {
  const result = validateHoidChapterReference(value);
  return result.status === "valid" ? result.reference : null;
}

function canonicalPath(value: unknown): HoidCuratedReadingPath | null {
  const raw = exactRecord(value, ["pathId", "title", "description", "steps"]);
  if (!raw || !validId(raw.pathId) || !validText(raw.title, 120) ||
    !validText(raw.description, 600)) return null;
  const rawSteps = denseArray(raw.steps, 1, MAXIMUM_STEPS);
  if (!rawSteps) return null;

  const previousSteps = new Map<string, Readonly<{ workId: string; index: number }>>();
  const seenStepIds = new Set<string>();
  const seenWorkIds = new Set<string>();
  const seenClaimEvidenceKeys = new Set<string>();
  const steps: HoidCuratedReadingPathStep[] = [];

  for (let index = 0; index < rawSteps.length; index += 1) {
    const step = exactRecord(rawSteps[index], [
      "stepId", "workId", "rationale", "prerequisites", "rationaleEvidence",
    ]);
    if (!step || !validId(step.stepId) || !validId(step.workId) ||
      !WORK_BY_ID.has(step.workId) || !validText(step.rationale, 600) ||
      seenStepIds.has(step.stepId) || seenWorkIds.has(step.workId)) return null;

    const rawPrerequisites = denseArray(step.prerequisites, 0, MAXIMUM_PREREQUISITES);
    const rawEvidence = denseArray(step.rationaleEvidence, 0, MAXIMUM_EVIDENCE);
    if (!rawPrerequisites || !rawEvidence) return null;
    if ((index === 0 && (rawPrerequisites.length !== 0 || rawEvidence.length !== 0)) ||
      (index > 0 && (rawPrerequisites.length === 0 || rawEvidence.length === 0))) return null;

    const prerequisites: HoidReadingPathPrerequisite[] = [];
    const seenPrerequisiteSteps = new Set<string>();
    for (const rawPrerequisite of rawPrerequisites) {
      const prerequisite = exactRecord(rawPrerequisite, ["stepId", "through"]);
      if (!prerequisite || !validId(prerequisite.stepId) ||
        seenPrerequisiteSteps.has(prerequisite.stepId)) return null;
      const previous = previousSteps.get(prerequisite.stepId);
      const through = canonicalReference(prerequisite.through);
      if (!previous || previous.index >= index || !through || through.bookId !== previous.workId) return null;
      seenPrerequisiteSteps.add(prerequisite.stepId);
      prerequisites.push(Object.freeze({ stepId: prerequisite.stepId, through }));
    }
    prerequisites.sort((left, right) =>
      (previousSteps.get(left.stepId)?.index ?? 0) - (previousSteps.get(right.stepId)?.index ?? 0));

    const rationaleEvidence: HoidReadingPathRationaleEvidence[] = [];
    for (const rawItem of rawEvidence) {
      const item = exactRecord(rawItem, ["claimId", "evidenceId", "reference"]);
      if (!item || !validId(item.claimId) || !validId(item.evidenceId)) return null;
      const claimEvidenceKey = JSON.stringify([item.claimId, item.evidenceId]);
      if (seenClaimEvidenceKeys.has(claimEvidenceKey)) return null;
      const reference = canonicalReference(item.reference);
      if (!reference) return null;
      const matchingPrerequisite = prerequisites.find(candidate =>
        candidate.through.bookId === reference.bookId);
      if (!matchingPrerequisite || reference.ordinal > matchingPrerequisite.through.ordinal) return null;
      seenClaimEvidenceKeys.add(claimEvidenceKey);
      rationaleEvidence.push(Object.freeze({
        claimId: item.claimId,
        evidenceId: item.evidenceId,
        reference,
      }));
    }
    rationaleEvidence.sort((left, right) =>
      left.claimId.localeCompare(right.claimId) || left.evidenceId.localeCompare(right.evidenceId));

    const canonicalStep: HoidCuratedReadingPathStep = Object.freeze({
      stepId: step.stepId,
      workId: step.workId,
      rationale: step.rationale,
      prerequisites: Object.freeze(prerequisites),
      rationaleEvidence: Object.freeze(rationaleEvidence),
    });
    steps.push(canonicalStep);
    seenStepIds.add(step.stepId);
    seenWorkIds.add(step.workId);
    previousSteps.set(step.stepId, Object.freeze({ workId: step.workId, index }));
  }

  const withoutFingerprint = Object.freeze({
    pathId: raw.pathId,
    title: raw.title,
    description: raw.description,
    steps: Object.freeze(steps),
  });
  return Object.freeze({
    ...withoutFingerprint,
    fingerprint: pathFingerprint(withoutFingerprint),
  });
}

/** Build a canonical route catalogue. An empty catalogue is valid but cannot recommend anything. */
export function buildHoidCuratedReadingPathCatalogue(
  input: unknown,
): HoidReadingPathCatalogueBuildResult {
  const raw = exactRecord(input, ["catalogueId", "revision", "paths"]);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-input" });
  if (!validId(raw.catalogueId)) return Object.freeze({ status: "invalid", reason: "invalid-catalogue-id" });
  if (typeof raw.revision !== "number" || !Number.isSafeInteger(raw.revision) ||
    raw.revision < 1 || raw.revision > Number.MAX_SAFE_INTEGER - 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-revision" });
  }
  const rawPaths = denseArray(raw.paths, 0, MAXIMUM_PATHS);
  if (!rawPaths) return Object.freeze({ status: "invalid", reason: "invalid-paths" });

  const paths: HoidCuratedReadingPath[] = [];
  const seen = new Set<string>();
  for (const rawPath of rawPaths) {
    const path = canonicalPath(rawPath);
    if (!path) return Object.freeze({ status: "invalid", reason: "invalid-path" });
    if (seen.has(path.pathId)) return Object.freeze({ status: "invalid", reason: "duplicate-path" });
    seen.add(path.pathId);
    paths.push(path);
  }
  paths.sort((left, right) => left.pathId.localeCompare(right.pathId));
  const frozenPaths = Object.freeze(paths);
  const catalogue: HoidCuratedReadingPathCatalogue = Object.freeze({
    schemaVersion: 1,
    kind: "hoid-curated-reading-path-catalogue",
    catalogueId: raw.catalogueId,
    revision: raw.revision,
    paths: frozenPaths,
    fingerprint: catalogueFingerprint(raw.catalogueId, raw.revision, frozenPaths),
  });
  return Object.freeze({ status: "ready", catalogue });
}

/** Rebuild the complete catalogue and compare its canonical serialization and fingerprint. */
export function validateHoidCuratedReadingPathCatalogue(
  input: unknown,
): HoidReadingPathCatalogueValidation {
  const raw = exactRecord(input, [
    "schemaVersion", "kind", "catalogueId", "revision", "paths", "fingerprint",
  ]);
  if (!raw || raw.schemaVersion !== 1 || raw.kind !== "hoid-curated-reading-path-catalogue" ||
    typeof raw.fingerprint !== "string" || !SHA_PATTERN.test(raw.fingerprint)) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  const rawPaths = denseArray(raw.paths, 0, MAXIMUM_PATHS);
  if (!rawPaths) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  const pathInputs: unknown[] = [];
  for (const rawPath of rawPaths) {
    const path = exactRecord(rawPath, ["pathId", "title", "description", "steps", "fingerprint"]);
    if (!path || typeof path.fingerprint !== "string" || !SHA_PATTERN.test(path.fingerprint)) {
      return Object.freeze({ status: "invalid", reason: "invalid-shape" });
    }
    pathInputs.push(Object.freeze({
      pathId: path.pathId,
      title: path.title,
      description: path.description,
      steps: path.steps,
    }));
  }

  const rebuilt = buildHoidCuratedReadingPathCatalogue({
    catalogueId: raw.catalogueId,
    revision: raw.revision,
    paths: pathInputs,
  });
  if (rebuilt.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "catalogue-mismatch" });
  }
  if (JSON.stringify(rebuilt.catalogue) !== JSON.stringify(input)) {
    return Object.freeze({ status: "invalid", reason: "fingerprint-mismatch" });
  }
  return Object.freeze({ status: "valid", catalogue: rebuilt.catalogue });
}

type CanonicalAttestation = HoidReadingPathApprovalAttestation;

function canonicalAttestations(
  value: unknown,
  expectedFingerprint: string,
): readonly CanonicalAttestation[] | null {
  const rawItems = denseArray(value, MINIMUM_APPROVALS, MAXIMUM_APPROVALS);
  if (!rawItems) return null;
  const attestations: CanonicalAttestation[] = [];
  const reviewerIds = new Set<string>();
  const keyIds = new Set<string>();
  for (const rawItem of rawItems) {
    const item = exactRecord(rawItem, [
      "schemaVersion", "catalogueFingerprint", "reviewerId", "decision",
      "reviewedAt", "keyId", "signatureHex",
    ]);
    if (!item || item.schemaVersion !== 1 || item.catalogueFingerprint !== expectedFingerprint ||
      !validId(item.reviewerId) || (item.decision !== "approve" && item.decision !== "reject") ||
      !canonicalTimestamp(item.reviewedAt) || !validId(item.keyId) ||
      typeof item.signatureHex !== "string" || !SIGNATURE_PATTERN.test(item.signatureHex) ||
      reviewerIds.has(item.reviewerId) || keyIds.has(item.keyId)) return null;
    reviewerIds.add(item.reviewerId);
    keyIds.add(item.keyId);
    attestations.push(Object.freeze({
      schemaVersion: 1,
      catalogueFingerprint: expectedFingerprint,
      reviewerId: item.reviewerId,
      decision: item.decision,
      reviewedAt: item.reviewedAt,
      keyId: item.keyId,
      signatureHex: item.signatureHex,
    }));
  }
  attestations.sort((left, right) => left.reviewerId.localeCompare(right.reviewerId));
  return Object.freeze(attestations);
}

/** Canonical, domain-separated payload for an offline or hardware-backed route reviewer. */
export function buildHoidReadingPathApprovalSigningMessage(input: unknown): string | null {
  const raw = exactRecord(input, [
    "repositoryFullName", "catalogueId", "revision", "catalogueFingerprint", "reviewerId",
    "decision", "reviewedAt", "keyId",
  ]);
  if (!raw || typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) || !validId(raw.catalogueId) ||
    typeof raw.revision !== "number" || !Number.isSafeInteger(raw.revision) || raw.revision < 1 ||
    typeof raw.catalogueFingerprint !== "string" || !SHA_PATTERN.test(raw.catalogueFingerprint) ||
    !validId(raw.reviewerId) || (raw.decision !== "approve" && raw.decision !== "reject") ||
    !canonicalTimestamp(raw.reviewedAt) || !validId(raw.keyId)) return null;
  return JSON.stringify([
    "hoid-curated-reading-path-catalogue-approval-ed25519-v1",
    raw.repositoryFullName,
    raw.catalogueId,
    raw.revision,
    raw.catalogueFingerprint,
    raw.reviewerId,
    raw.decision,
    raw.reviewedAt,
    raw.keyId,
  ]);
}

/**
 * Verify two or more independent route approvals against the root-authenticated
 * reviewer registry. The injected Ed25519 port owns cryptographic execution;
 * this module creates no keys and trusts no self-asserted approval state.
 */
export async function verifyHoidCuratedReadingPathCatalogueApproval(
  input: unknown,
): Promise<HoidReadingPathApprovalVerification> {
  const raw = exactRecord(input, [
    "catalogue", "attestations", "repositoryFullName", "registry",
    "rootKey", "verifier", "now", "minimumRegistryRevision",
  ]);
  if (!raw || typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !canonicalTimestamp(raw.now) ||
    typeof raw.minimumRegistryRevision !== "number" ||
    !Number.isSafeInteger(raw.minimumRegistryRevision) || raw.minimumRegistryRevision < 1) {
    return Object.freeze({
      status: "invalid", reason: "invalid-input",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }

  const catalogueValidation = validateHoidCuratedReadingPathCatalogue(raw.catalogue);
  if (catalogueValidation.status !== "valid") {
    return Object.freeze({
      status: "invalid", reason: "invalid-catalogue",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }
  const catalogue = catalogueValidation.catalogue;
  if (catalogue.paths.length === 0) {
    return Object.freeze({
      status: "invalid", reason: "empty-catalogue",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }
  const attestations = canonicalAttestations(raw.attestations, catalogue.fingerprint);
  if (!attestations) {
    return Object.freeze({
      status: "invalid", reason: "invalid-attestations",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }
  const verifierRecord = exactRecord(raw.verifier, ["verify"]);
  if (!verifierRecord || typeof verifierRecord.verify !== "function") {
    return Object.freeze({
      status: "invalid", reason: "invalid-verifier",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }

  const requests = attestations.map(attestation => {
    const message = buildHoidReadingPathApprovalSigningMessage({
      repositoryFullName: raw.repositoryFullName,
      catalogueId: catalogue.catalogueId,
      revision: catalogue.revision,
      catalogueFingerprint: catalogue.fingerprint,
      reviewerId: attestation.reviewerId,
      decision: attestation.decision,
      reviewedAt: attestation.reviewedAt,
      keyId: attestation.keyId,
    });
    return message === null ? null : Object.freeze({
      repositoryFullName: raw.repositoryFullName as string,
      reviewerId: attestation.reviewerId,
      reviewedAt: attestation.reviewedAt,
      keyId: attestation.keyId,
      message,
      signatureHex: attestation.signatureHex,
    });
  });
  const canonicalRequests = requests.filter((request): request is NonNullable<typeof request> => request !== null);
  if (canonicalRequests.length !== attestations.length) {
    return Object.freeze({
      status: "invalid", reason: "invalid-attestations",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }

  let trust: Awaited<ReturnType<typeof verifyHoidReviewerBoundPayloadSignatures>>;
  try {
    trust = await verifyHoidReviewerBoundPayloadSignatures(
      canonicalRequests,
      raw.registry as HoidReviewerTrustRegistry,
      raw.rootKey as HoidReviewerTrustRootKey,
      raw.verifier as HoidEd25519VerificationPort,
      raw.now,
      raw.minimumRegistryRevision,
    );
  } catch {
    return Object.freeze({
      status: "blocked", reason: "verifier-failed",
      promotionAllowed: false, productionWritePerformed: false,
    });
  }
  if (trust.status !== "verified" || trust.verifiedCount !== attestations.length) {
    return Object.freeze({
      status: "blocked",
      reason: "trust-verification-failed",
      trustReason: trust.status === "invalid" ? trust.reason : "incomplete-verification",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const reviewerIds = Object.freeze(attestations.map(item => item.reviewerId));
  const keyIds = Object.freeze(attestations.map(item => item.keyId));
  if (attestations.some(item => item.decision === "reject")) {
    return Object.freeze({
      status: "rejected",
      catalogueFingerprint: catalogue.fingerprint,
      registryRevision: trust.registryRevision,
      reviewerIds,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  return Object.freeze({
    status: "verified",
    catalogueFingerprint: catalogue.fingerprint,
    registryRevision: trust.registryRevision,
    reviewerIds,
    keyIds,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function prerequisiteCompleted(
  prerequisite: HoidReadingPathPrerequisite,
  progress: HoidUnitProgressSnapshot,
): boolean {
  const position = progress.positions.find(item => item.bookId === prerequisite.through.bookId);
  if (!position) return false;
  if ("completed" in position && position.completed === true) return true;
  if (!("cursor" in position)) return false;
  const cursor = validateHoidUnitProgressCursor(position.cursor);
  return cursor.status === "valid" &&
    cursor.boundary.completedThroughOrdinal !== null &&
    cursor.boundary.completedThroughOrdinal >= prerequisite.through.ordinal;
}

function recommendationPlanFingerprint(
  catalogueFingerprint: string,
  progressRevision: number,
  progressFingerprint: string,
  registryRevision: number,
  rationaleEvidenceFingerprint: string,
  recommendations: readonly HoidCuratedReadingPathRecommendation[],
): string {
  return sha256Hex(JSON.stringify([
    "hoid-curated-reading-path-recommendation-plan-v1",
    catalogueFingerprint,
    progressRevision,
    progressFingerprint,
    registryRevision,
    rationaleEvidenceFingerprint,
    recommendations.map(item => [
      item.pathId, item.pathTitle, item.pathFingerprint, item.stepId,
      item.workId, item.workTitle, item.rationale, item.navigation,
    ]),
  ]));
}

type VerifiedRouteRationaleEvidence = Readonly<{
  fingerprint: string;
  registryRevision: number | null;
}>;

/**
 * Bind every route rationale to an actually signed exact-unit claim package.
 * The route's evidence reference must equal the package's source reference,
 * and the route prerequisites must cover source, first-safe-appearance and
 * unlock references. This prevents a signed route from citing a plausible but
 * nonexistent evidence ID, or from revealing its rationale before a policy's
 * later unlock boundary.
 */
async function verifyRouteRationaleEvidence(
  catalogue: HoidCuratedReadingPathCatalogue,
  evidencePackagesInput: unknown,
  evidenceContextInput: unknown,
  repositoryFullName: string,
  registry: unknown,
  rootKey: unknown,
  verifier: unknown,
  now: unknown,
  minimumRegistryRevision: unknown,
): Promise<VerifiedRouteRationaleEvidence | null> {
  const evidenceReferences = catalogue.paths.flatMap(path =>
    path.steps.flatMap(step => step.rationaleEvidence.map(evidence => ({
      path,
      step,
      evidence,
    }))),
  );
  const rawPackages = denseArray(evidencePackagesInput, 0, 512);
  if (!rawPackages) return null;

  if (evidenceReferences.length === 0) {
    if (rawPackages.length !== 0) return null;
    return Object.freeze({
      fingerprint: sha256Hex(JSON.stringify(["hoid-curated-reading-path-evidence-v1", []])),
      registryRevision: null,
    });
  }

  const context = exactRecord(evidenceContextInput, [
    "schemaVersion", "repositoryFullName", "pullRequestNumber", "baseRef", "baseSha",
    "headRef", "headSha", "promotionManifestPath", "promotionPlanFingerprint",
    "reviewBundleFingerprint",
  ]);
  if (!context || context.schemaVersion !== 1 ||
    context.repositoryFullName !== repositoryFullName) return null;

  const verified = await verifyHoidExactUnitClaimSignatures(
    rawPackages,
    evidenceContextInput as HoidApprovedClaimReviewSignatureContext,
    registry as HoidReviewerTrustRegistry,
    rootKey as HoidReviewerTrustRootKey,
    verifier as HoidEd25519VerificationPort,
    now,
    minimumRegistryRevision,
  );
  if (verified.status !== "verified") return null;

  const packageByClaimId = new Map(
    verified.packages.map(item => [item.claim.id, item] as const),
  );

  const bindings: unknown[] = [];
  for (const { path, step, evidence } of evidenceReferences) {
    const claimPackage = packageByClaimId.get(evidence.claimId);
    if (!claimPackage || !claimPackage.claim.evidenceIds.includes(evidence.evidenceId)) return null;
    const policy = claimPackage.policies.find(item => item.evidenceId === evidence.evidenceId);
    if (!policy ||
      JSON.stringify(referenceValue(policy.source)) !==
        JSON.stringify(referenceValue(evidence.reference))) return null;

    // A claim may cite multiple evidence records. The route rationale must
    // declare all of them under the same exact claim ID.
    const stepClaimEvidenceIds = new Set(step.rationaleEvidence
      .filter(item => item.claimId === evidence.claimId)
      .map(item => item.evidenceId));
    if (!claimPackage.claim.evidenceIds.every(id => stepClaimEvidenceIds.has(id))) return null;

    const policyRequirements = [
      policy.source,
      policy.firstSafeAppearance,
      policy.unlock,
    ];
    for (const requirement of policyRequirements) {
      const prerequisite = step.prerequisites.find(item =>
        item.through.bookId === requirement.bookId);
      if (!prerequisite || prerequisite.through.ordinal < requirement.ordinal) return null;
    }

    bindings.push([
      path.pathId,
      step.stepId,
      evidence.claimId,
      evidence.evidenceId,
      referenceValue(policy.source),
      referenceValue(policy.firstSafeAppearance),
      referenceValue(policy.unlock),
      claimPackage.claim.evidenceIds,
    ]);
  }

  const claimFingerprints = verified.claims
    .map(item => [item.claimId, item.reviewerId, item.keyId, item.messageFingerprint])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return Object.freeze({
    fingerprint: sha256Hex(JSON.stringify([
      "hoid-curated-reading-path-evidence-v1",
      verified.contextFingerprint,
      verified.registryRevision,
      claimFingerprints,
      bindings,
    ])),
    registryRevision: verified.registryRevision,
  });
}

/**
 * Recommend only the first unstarted step whose exact prerequisites have been
 * completed. A new work is a manual reader choice, never a chapter navigation
 * handoff. No AI provider is called and no progress is mutated.
 */
export async function evaluateHoidCuratedReadingPathRecommendations(
  input: unknown,
): Promise<HoidCuratedReadingPathEvaluation> {
  const raw = exactRecord(input, [
    "catalogue", "progressSnapshot", "attestations", "repositoryFullName",
    "registry", "rootKey", "verifier", "now", "minimumRegistryRevision",
    "evidencePackages", "evidenceContext",
  ]);
  if (!raw) return Object.freeze({
    status: "invalid", reason: "invalid-input",
    promotionAllowed: false, productionWritePerformed: false,
  });

  const catalogueValidation = validateHoidCuratedReadingPathCatalogue(raw.catalogue);
  if (catalogueValidation.status !== "valid") return Object.freeze({
    status: "invalid", reason: "invalid-catalogue",
    promotionAllowed: false, productionWritePerformed: false,
  });
  const catalogue = catalogueValidation.catalogue;
  if (catalogue.paths.length === 0) return Object.freeze({
    status: "no-curated-paths",
    catalogueFingerprint: catalogue.fingerprint,
    promotionAllowed: false,
    productionWritePerformed: false,
  });

  const progressValidation = validateHoidUnitProgressSnapshot(raw.progressSnapshot);
  if (progressValidation.status !== "valid") return Object.freeze({
    status: "blocked", reason: "progress-invalid",
    promotionAllowed: false, productionWritePerformed: false,
  });

  const rationaleEvidence = await verifyRouteRationaleEvidence(
    catalogue,
    raw.evidencePackages,
    raw.evidenceContext,
    raw.repositoryFullName as string,
    raw.registry,
    raw.rootKey,
    raw.verifier,
    raw.now,
    raw.minimumRegistryRevision,
  );
  if (!rationaleEvidence) return Object.freeze({
    status: "blocked", reason: "evidence-unverified",
    promotionAllowed: false, productionWritePerformed: false,
  });

  const approval = await verifyHoidCuratedReadingPathCatalogueApproval({
    catalogue,
    attestations: raw.attestations,
    repositoryFullName: raw.repositoryFullName,
    registry: raw.registry,
    rootKey: raw.rootKey,
    verifier: raw.verifier,
    now: raw.now,
    minimumRegistryRevision: raw.minimumRegistryRevision,
  });
  if (approval.status === "rejected") return Object.freeze({
    status: "blocked", reason: "approval-rejected",
    promotionAllowed: false, productionWritePerformed: false,
  });
  if (approval.status === "blocked") return Object.freeze({
    status: "blocked", reason: "approval-required",
    promotionAllowed: false, productionWritePerformed: false,
  });
  if (approval.status !== "verified") return Object.freeze({
    status: "invalid", reason: "invalid-approval",
    promotionAllowed: false, productionWritePerformed: false,
  });

  if (
    rationaleEvidence.registryRevision !== null &&
    rationaleEvidence.registryRevision !== approval.registryRevision
  ) return Object.freeze({
    status: "blocked", reason: "evidence-unverified",
    promotionAllowed: false, productionWritePerformed: false,
  });

  const progress = progressValidation.snapshot;
  const progressFingerprint = sha256Hex(JSON.stringify(progress));
  const recommendations: HoidCuratedReadingPathRecommendation[] = [];
  let completedPathCount = 0;
  let waitingPathCount = 0;
  let inProgressPathCount = 0;

  for (const path of catalogue.paths) {
    let pathState: "completed" | "waiting" | "in-progress" | "recommended" = "completed";
    let encounteredInProgressStep = false;
    for (const step of path.steps) {
      if (!step.prerequisites.every(item => prerequisiteCompleted(item, progress))) {
        pathState = "waiting";
        break;
      }
      const position = progress.positions.find(item => item.bookId === step.workId);
      if (position && "completed" in position && position.completed === true) continue;
      if (position && "cursor" in position) {
        // An already-open step is not recommended again. Continue evaluating
        // later steps, whose own exact prerequisites decide when they unlock.
        encounteredInProgressStep = true;
        continue;
      }
      const work = WORK_BY_ID.get(step.workId);
      if (!work) {
        pathState = "waiting";
        break;
      }
      recommendations.push(Object.freeze({
        pathId: path.pathId,
        pathTitle: path.title,
        pathFingerprint: path.fingerprint,
        stepId: step.stepId,
        workId: work.id,
        workTitle: work.title,
        rationale: step.rationale,
        navigation: "manual-reader-selection-required",
      }));
      pathState = "recommended";
      break;
    }
    if (pathState === "completed" && encounteredInProgressStep) pathState = "in-progress";
    if (pathState === "completed") completedPathCount += 1;
    if (pathState === "waiting") waitingPathCount += 1;
    if (pathState === "in-progress") inProgressPathCount += 1;
  }

  recommendations.sort((left, right) => left.pathId.localeCompare(right.pathId));
  const selected = Object.freeze(recommendations.slice(0, MAXIMUM_RECOMMENDATIONS));
  if (selected.length === 0) {
    const reason = completedPathCount === catalogue.paths.length
      ? "all-paths-completed"
      : waitingPathCount > 0
        ? "prerequisites-incomplete"
        : "path-step-in-progress";
    return Object.freeze({
      status: "no-eligible-next-work",
      reason,
      catalogueFingerprint: catalogue.fingerprint,
      progressRevision: progress.revision,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const fingerprint = recommendationPlanFingerprint(
    catalogue.fingerprint,
    progress.revision,
    progressFingerprint,
    approval.registryRevision,
    rationaleEvidence.fingerprint,
    selected,
  );
  return Object.freeze({
    status: "ready",
    plan: Object.freeze({
      schemaVersion: 1,
      kind: "hoid-curated-reading-path-recommendation-plan",
      catalogueFingerprint: catalogue.fingerprint,
      progressRevision: progress.revision,
      progressFingerprint,
      registryRevision: approval.registryRevision,
      rationaleEvidenceFingerprint: rationaleEvidence.fingerprint,
      recommendations: selected,
      fingerprint,
    }),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/** Re-run catalogue, quorum and progress checks before presenting a saved plan. */
export async function validateHoidCuratedReadingPathRecommendationPlan(
  input: unknown,
): Promise<HoidCuratedReadingPathPlanValidation> {
  const raw = exactRecord(input, [
    "plan", "catalogue", "progressSnapshot", "attestations", "repositoryFullName",
    "registry", "rootKey", "verifier", "now", "minimumRegistryRevision",
    "evidencePackages", "evidenceContext",
  ]);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-input" });

  let serializedPlan: string;
  try {
    if (!isPlainJsonData(raw.plan)) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
    serializedPlan = JSON.stringify(raw.plan);
    if (typeof serializedPlan !== "string" || serializedPlan.length > 1_000_000) {
      return Object.freeze({ status: "invalid", reason: "invalid-plan" });
    }
  } catch {
    return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  }

  const current = await evaluateHoidCuratedReadingPathRecommendations({
    catalogue: raw.catalogue,
    progressSnapshot: raw.progressSnapshot,
    attestations: raw.attestations,
    repositoryFullName: raw.repositoryFullName,
    registry: raw.registry,
    rootKey: raw.rootKey,
    verifier: raw.verifier,
    now: raw.now,
    minimumRegistryRevision: raw.minimumRegistryRevision,
    evidencePackages: raw.evidencePackages,
    evidenceContext: raw.evidenceContext,
  });
  if (current.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "current-plan-unavailable" });
  }
  if (serializedPlan !== JSON.stringify(current.plan)) {
    return Object.freeze({ status: "invalid", reason: "stale-or-tampered-plan" });
  }
  return Object.freeze({ status: "valid", plan: current.plan });
}

function isPlainJsonData(
  value: unknown,
  depth = 0,
  ancestors: Set<object> = new Set(),
): boolean {
  if (depth > 48) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return false;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || !keys.includes("length")) return false;
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true ||
          !isPlainJsonData(descriptor.value, depth + 1, ancestors)) return false;
      }
      return true;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        !isPlainJsonData(descriptor.value, depth + 1, ancestors)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}

/** Explicitly empty until a real route has evidence and two trusted approvals. */
const EMPTY_CATALOGUE = buildHoidCuratedReadingPathCatalogue({
  catalogueId: "cosmere-curated-reading-paths",
  revision: 1,
  paths: [],
});

export const HOID_CURATED_READING_PATH_CATALOGUE =
  EMPTY_CATALOGUE.status === "ready" ? EMPTY_CATALOGUE.catalogue : null;

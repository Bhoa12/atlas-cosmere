import {
  validateHoidEditorialKnowledgeBundleManifest,
  type HoidEditorialKnowledgeBundleManifest,
} from "./editorialKnowledgeBundle";
import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
  type HoidEditorialReviewPacket,
} from "./editorialReviewPackets";
import {
  buildHoidEditorialClaimReviewPackets,
  validateHoidEditorialClaimReviewReceipt,
  type HoidEditorialClaimReviewPacket,
} from "./editorialClaimReviewPackets";
import {
  buildHoidEditorialEntityReviewPackets,
  validateHoidEditorialEntityReviewReceipt,
  type HoidEditorialEntityReviewPacket,
} from "./editorialEntityDrafts";
import {
  buildHoidEditorialRelationshipReviewPackets,
  validateHoidEditorialRelationshipReviewReceipt,
  type HoidEditorialRelationshipReviewPacket,
} from "./editorialRelationshipDrafts";
import { sha256Hex } from "./sha256";

export type HoidEditorialReviewCategory = "summary" | "atomic-claim" | "entity" | "relationship";

export type HoidEditorialReviewPacketReference = Readonly<{
  category: HoidEditorialReviewCategory;
  draftId: string;
  packetId: string;
  contentSha256: string;
}>;

export type HoidEditorialReviewBundleCounts = Readonly<{
  summaries: number;
  atomicClaims: number;
  entities: number;
  relationships: number;
}>;

export type HoidEditorialReviewBundleManifest = Readonly<{
  schemaVersion: 1;
  status: "ready-for-review";
  knowledgeBundleFingerprint: string;
  counts: HoidEditorialReviewBundleCounts;
  packets: readonly HoidEditorialReviewPacketReference[];
  fingerprint: string;
}>;

export type HoidEditorialReviewBundlePackets = Readonly<{
  summaries: readonly HoidEditorialReviewPacket[];
  claims: readonly HoidEditorialClaimReviewPacket[];
  entities: readonly HoidEditorialEntityReviewPacket[];
  relationships: readonly HoidEditorialRelationshipReviewPacket[];
}>;

export type HoidEditorialReviewBundleBuildResult =
  | Readonly<{
      status: "ready-for-review";
      manifest: HoidEditorialReviewBundleManifest;
      packets: HoidEditorialReviewBundlePackets;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "knowledge-bundle-blocked";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-knowledge-manifest"
        | "invalid-summaries"
        | "invalid-claims"
        | "invalid-entities"
        | "invalid-relationships"
        | "packet-coverage-mismatch"
        | "invalid-review-manifest";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidEditorialReviewBundleValidation =
  | Readonly<{
      status: "valid";
      manifest: HoidEditorialReviewBundleManifest;
      packetCount: number;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-review-manifest" | "review-bundle-fingerprint-mismatch" | "review-bundle-content-mismatch";
    }>;

export type HoidEditorialReviewBundleReceipts = Readonly<{
  schemaVersion: 1;
  reviewBundleFingerprint: string;
  summaries: readonly unknown[];
  claims: readonly unknown[];
  entities: readonly unknown[];
  relationships: readonly unknown[];
}>;

export type HoidEditorialReviewBundleReceiptValidation =
  | Readonly<{
      status: "complete";
      approvedCount: number;
      revisionRequiredCount: 0;
      rejectedCount: 0;
      missingCount: 0;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "needs-revision";
      approvedCount: number;
      revisionRequiredCount: number;
      rejectedCount: number;
      missingCount: 0;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "incomplete";
      approvedCount: number;
      revisionRequiredCount: number;
      rejectedCount: number;
      missingCount: number;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-review-bundle"
        | "review-bundle-mismatch"
        | "invalid-receipt-batch"
        | "unknown-or-duplicate-packet"
        | "receipt-validation-failed";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const REVIEW_MANIFEST_KEYS = new Set([
  "schemaVersion", "status", "knowledgeBundleFingerprint", "counts", "packets", "fingerprint",
]);
const COUNTS_KEYS = new Set(["summaries", "atomicClaims", "entities", "relationships"]);
const PACKET_REFERENCE_KEYS = new Set(["category", "draftId", "packetId", "contentSha256"]);
const RECEIPT_BUNDLE_KEYS = new Set([
  "schemaVersion", "reviewBundleFingerprint", "summaries", "claims", "entities", "relationships",
]);
const CATEGORIES = new Set<HoidEditorialReviewCategory>([
  "summary", "atomic-claim", "entity", "relationship",
]);
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const MAX_PACKETS = 2_048;

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
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
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalPacketReference(value: unknown): HoidEditorialReviewPacketReference | null {
  const raw = canonicalRecord(value, PACKET_REFERENCE_KEYS);
  if (
    !raw ||
    typeof raw.category !== "string" ||
    !CATEGORIES.has(raw.category as HoidEditorialReviewCategory) ||
    typeof raw.draftId !== "string" ||
    !ID_PATTERN.test(raw.draftId) ||
    typeof raw.packetId !== "string" ||
    !(raw.category === "summary" ? /^review:[a-f0-9]{64}$/.test(raw.packetId) : SHA_PATTERN.test(raw.packetId)) ||
    typeof raw.contentSha256 !== "string" ||
    !SHA_PATTERN.test(raw.contentSha256)
  ) return null;
  return Object.freeze({
    category: raw.category as HoidEditorialReviewCategory,
    draftId: raw.draftId,
    packetId: raw.packetId,
    contentSha256: raw.contentSha256,
  });
}

function compareReferences(
  left: HoidEditorialReviewPacketReference,
  right: HoidEditorialReviewPacketReference,
): number {
  const order: Record<HoidEditorialReviewCategory, number> = {
    summary: 0,
    "atomic-claim": 1,
    entity: 2,
    relationship: 3,
  };
  return order[left.category] - order[right.category] ||
    left.draftId.localeCompare(right.draftId);
}

function reviewBundleFingerprint(
  knowledgeBundleFingerprint: string,
  counts: HoidEditorialReviewBundleCounts,
  packets: readonly HoidEditorialReviewPacketReference[],
): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-review-bundle-v1",
    knowledgeBundleFingerprint,
    counts,
    packets,
  ]));
}

function invalidBuild(
  reason: Extract<HoidEditorialReviewBundleBuildResult, { status: "invalid" }>["reason"],
): HoidEditorialReviewBundleBuildResult {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function packetReferences(packets: HoidEditorialReviewBundlePackets): readonly HoidEditorialReviewPacketReference[] {
  const refs: HoidEditorialReviewPacketReference[] = [];
  for (const packet of packets.summaries) {
    refs.push(Object.freeze({
      category: "summary",
      draftId: packet.draftId,
      packetId: packet.packetId,
      contentSha256: packet.summarySha256,
    }));
  }
  for (const packet of packets.claims) {
    refs.push(Object.freeze({
      category: "atomic-claim",
      draftId: packet.draftId,
      packetId: packet.packetId,
      contentSha256: packet.claimSha256,
    }));
  }
  for (const packet of packets.entities) {
    refs.push(Object.freeze({
      category: "entity",
      draftId: packet.draftId,
      packetId: packet.packetId,
      contentSha256: packet.draftSha256,
    }));
  }
  for (const packet of packets.relationships) {
    refs.push(Object.freeze({
      category: "relationship",
      draftId: packet.draftId,
      packetId: packet.packetId,
      contentSha256: packet.claimSha256,
    }));
  }
  return Object.freeze(refs.sort(compareReferences));
}

function buildPacketGroups(sourceInput: unknown): HoidEditorialReviewBundlePackets | null {
  const source = canonicalRecord(sourceInput, new Set(["summaries", "claims", "entities", "relationships"]));
  if (!source) return null;
  const summaries = buildHoidEditorialReviewPackets(source.summaries);
  if (summaries.status !== "ready") return null;
  const claims = buildHoidEditorialClaimReviewPackets(source.claims);
  if (claims.status !== "ready") return null;
  const entities = buildHoidEditorialEntityReviewPackets(source.entities);
  if (entities.status !== "ready") return null;
  const relationships = buildHoidEditorialRelationshipReviewPackets(source.relationships);
  if (relationships.status !== "ready") return null;
  return Object.freeze({
    summaries: summaries.packets,
    claims: claims.packets,
    entities: entities.packets,
    relationships: relationships.packets,
  });
}

/** Build one review session covering every validated editorial category. */
export function buildHoidEditorialReviewBundle(
  knowledgeManifestInput: unknown,
  sourceInput: unknown,
): HoidEditorialReviewBundleBuildResult {
  const knowledge = validateHoidEditorialKnowledgeBundleManifest(knowledgeManifestInput, sourceInput);
  if (knowledge.status !== "valid") return invalidBuild("invalid-knowledge-manifest");
  if (knowledge.bundleStatus !== "ready-for-review") {
    return Object.freeze({
      status: "blocked",
      reason: "knowledge-bundle-blocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const packets = buildPacketGroups(sourceInput);
  if (!packets) return invalidBuild("invalid-summaries");
  const refs = packetReferences(packets);
  if (refs.length === 0 || refs.length > MAX_PACKETS) return invalidBuild("packet-coverage-mismatch");

  const expected = new Set(knowledge.manifest.records.map(record => record.kind + ":" + record.id));
  const actual = new Set<string>();
  for (const ref of refs) {
    const key = (ref.category === "atomic-claim" ? "atomic-claim" : ref.category) + ":" + ref.draftId;
    if (actual.has(key)) return invalidBuild("packet-coverage-mismatch");
    actual.add(key);
  }
  if (
    actual.size !== expected.size ||
    [...expected].some(key => !actual.has(key))
  ) return invalidBuild("packet-coverage-mismatch");

  const counts: HoidEditorialReviewBundleCounts = Object.freeze({
    summaries: packets.summaries.length,
    atomicClaims: packets.claims.length,
    entities: packets.entities.length,
    relationships: packets.relationships.length,
  });
  const manifest: HoidEditorialReviewBundleManifest = Object.freeze({
    schemaVersion: 1,
    status: "ready-for-review",
    knowledgeBundleFingerprint: knowledge.manifest.fingerprint,
    counts,
    packets: refs,
    fingerprint: reviewBundleFingerprint(knowledge.manifest.fingerprint, counts, refs),
  });
  return Object.freeze({
    status: "ready-for-review",
    manifest,
    packets,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function canonicalReviewManifest(value: unknown): HoidEditorialReviewBundleManifest | null {
  const raw = canonicalRecord(value, REVIEW_MANIFEST_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.status !== "ready-for-review" ||
    typeof raw.knowledgeBundleFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.knowledgeBundleFingerprint) ||
    typeof raw.fingerprint !== "string" ||
    !SHA_PATTERN.test(raw.fingerprint)
  ) return null;

  const counts = canonicalRecord(raw.counts, COUNTS_KEYS);
  if (!counts) return null;
  for (const key of COUNTS_KEYS) {
    if (!Number.isSafeInteger(counts[key]) || (counts[key] as number) < 0) return null;
  }
  const rawPackets = canonicalDenseArray(raw.packets, MAX_PACKETS);
  if (!rawPackets || rawPackets.length === 0) return null;
  const packets: HoidEditorialReviewPacketReference[] = [];
  const seen = new Set<string>();
  for (const item of rawPackets) {
    const packet = canonicalPacketReference(item);
    if (!packet) return null;
    const key = packet.category + ":" + packet.draftId;
    if (seen.has(key)) return null;
    seen.add(key);
    packets.push(packet);
  }
  const sorted = [...packets].sort(compareReferences);
  if (JSON.stringify(sorted) !== JSON.stringify(packets)) return null;

  const canonicalCounts = Object.freeze({
    summaries: counts.summaries as number,
    atomicClaims: counts.atomicClaims as number,
    entities: counts.entities as number,
    relationships: counts.relationships as number,
  });
  if (
    canonicalCounts.summaries !== packets.filter(item => item.category === "summary").length ||
    canonicalCounts.atomicClaims !== packets.filter(item => item.category === "atomic-claim").length ||
    canonicalCounts.entities !== packets.filter(item => item.category === "entity").length ||
    canonicalCounts.relationships !== packets.filter(item => item.category === "relationship").length
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    status: "ready-for-review",
    knowledgeBundleFingerprint: raw.knowledgeBundleFingerprint,
    counts: canonicalCounts,
    packets: Object.freeze(packets),
    fingerprint: raw.fingerprint,
  });
}

/** Rebuild the packet inventory from the exact four source batches before trusting a review manifest. */
export function validateHoidEditorialReviewBundleManifest(
  manifestInput: unknown,
  knowledgeManifestInput: unknown,
  sourceInput: unknown,
): HoidEditorialReviewBundleValidation {
  const manifest = canonicalReviewManifest(manifestInput);
  if (!manifest) return Object.freeze({ status: "invalid", reason: "invalid-review-manifest" });
  const suppliedFingerprint = reviewBundleFingerprint(
    manifest.knowledgeBundleFingerprint,
    manifest.counts,
    manifest.packets,
  );
  if (suppliedFingerprint !== manifest.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "review-bundle-fingerprint-mismatch" });
  }
  const rebuilt = buildHoidEditorialReviewBundle(knowledgeManifestInput, sourceInput);
  if (rebuilt.status !== "ready-for-review") {
    return Object.freeze({ status: "invalid", reason: "review-bundle-content-mismatch" });
  }
  if (JSON.stringify(manifest) !== JSON.stringify(rebuilt.manifest)) {
    return Object.freeze({ status: "invalid", reason: "review-bundle-content-mismatch" });
  }
  return Object.freeze({
    status: "valid",
    manifest: rebuilt.manifest,
    packetCount: rebuilt.manifest.packets.length,
  });
}

function ownPacketId(value: unknown): string | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, "packetId");
    return descriptor &&
      Object.prototype.hasOwnProperty.call(descriptor, "value") &&
      descriptor.enumerable === true &&
      typeof descriptor.value === "string"
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

type ReceiptCounts = Readonly<{
  approved: number;
  revisionRequired: number;
  rejected: number;
  missing: number;
  invalid: boolean;
}>;

function validateReceiptSet<TPacket>(
  packets: readonly TPacket[],
  receiptsInput: unknown,
  packetIdOf: (packet: TPacket) => string,
  validate: (packet: TPacket, receipt: unknown) => { status: string; outcome?: string },
): ReceiptCounts {
  const receipts = canonicalDenseArray(receiptsInput, MAX_PACKETS);
  if (!receipts) return Object.freeze({ approved: 0, revisionRequired: 0, rejected: 0, missing: 0, invalid: true });
  const byId = new Map(packets.map(packet => [packetIdOf(packet), packet]));
  const seen = new Set<string>();
  let approved = 0;
  let revisionRequired = 0;
  let rejected = 0;
  for (const receipt of receipts) {
    const id = ownPacketId(receipt);
    if (!id || seen.has(id)) {
      return Object.freeze({ approved, revisionRequired, rejected, missing: 0, invalid: true });
    }
    const packet = byId.get(id);
    if (!packet) {
      return Object.freeze({ approved, revisionRequired, rejected, missing: 0, invalid: true });
    }
    seen.add(id);
    const result = validate(packet, receipt);
    if (result.status !== "valid") {
      return Object.freeze({ approved, revisionRequired, rejected, missing: 0, invalid: true });
    }
    if (result.outcome === "approved-awaiting-source-promotion") approved += 1;
    else if (result.outcome === "revision-required") revisionRequired += 1;
    else if (result.outcome === "rejected") rejected += 1;
    else return Object.freeze({ approved, revisionRequired, rejected, missing: 0, invalid: true });
  }
  return Object.freeze({
    approved,
    revisionRequired,
    rejected,
    missing: packets.length - seen.size,
    invalid: false,
  });
}

function invalidReceiptBundle(
  reason: Extract<HoidEditorialReviewBundleReceiptValidation, { status: "invalid" }>["reason"],
): HoidEditorialReviewBundleReceiptValidation {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Validate a complete receipt set against the exact review packets. This is
 * structural validation only: reviewer identity/independence must be proven
 * separately by protected source-control review.
 */
export function validateHoidEditorialReviewBundleReceipts(
  manifestInput: unknown,
  knowledgeManifestInput: unknown,
  sourceInput: unknown,
  receiptsInput: unknown,
): HoidEditorialReviewBundleReceiptValidation {
  const review = validateHoidEditorialReviewBundleManifest(
    manifestInput,
    knowledgeManifestInput,
    sourceInput,
  );
  if (review.status !== "valid") return invalidReceiptBundle("invalid-review-bundle");

  const raw = canonicalRecord(receiptsInput, RECEIPT_BUNDLE_KEYS);
  if (!raw || raw.schemaVersion !== 1) return invalidReceiptBundle("invalid-receipt-batch");
  if (raw.reviewBundleFingerprint !== review.manifest.fingerprint) {
    return invalidReceiptBundle("review-bundle-mismatch");
  }

  const packets = buildPacketGroups(sourceInput);
  if (!packets) return invalidReceiptBundle("invalid-review-bundle");

  const summaryCounts = validateReceiptSet(
    packets.summaries,
    raw.summaries,
    packet => packet.packetId,
    validateHoidEditorialReviewReceipt,
  );
  const claimCounts = validateReceiptSet(
    packets.claims,
    raw.claims,
    packet => packet.packetId,
    validateHoidEditorialClaimReviewReceipt,
  );
  const entityCounts = validateReceiptSet(
    packets.entities,
    raw.entities,
    packet => packet.packetId,
    validateHoidEditorialEntityReviewReceipt,
  );
  const relationshipCounts = validateReceiptSet(
    packets.relationships,
    raw.relationships,
    packet => packet.packetId,
    validateHoidEditorialRelationshipReviewReceipt,
  );
  const all = [summaryCounts, claimCounts, entityCounts, relationshipCounts];
  if (all.some(item => item.invalid)) {
    return invalidReceiptBundle("receipt-validation-failed");
  }

  const approvedCount = all.reduce((total, item) => total + item.approved, 0);
  const revisionRequiredCount = all.reduce((total, item) => total + item.revisionRequired, 0);
  const rejectedCount = all.reduce((total, item) => total + item.rejected, 0);
  const missingCount = all.reduce((total, item) => total + item.missing, 0);
  const base = {
    approvedCount,
    revisionRequiredCount,
    rejectedCount,
    missingCount,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  };

  if (missingCount > 0) return Object.freeze({ status: "incomplete", ...base });
  if (revisionRequiredCount > 0 || rejectedCount > 0) {
    return Object.freeze({ status: "needs-revision", ...base });
  }
  return Object.freeze({ status: "complete", ...base });
}

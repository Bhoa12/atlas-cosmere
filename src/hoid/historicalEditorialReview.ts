import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { HOID_EPUB_INGESTION_LIMITS } from "./epubIngestion";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";

export type HoidHistoricalReviewSourceEvidence = Readonly<{
  receiptFingerprint: string;
  documentSha256: string;
  navigationSha256: string;
  byteLength: number;
  inspectedAt: string;
}>;

export type HoidHistoricalEditorialChecklist = Readonly<{
  factualAccuracy: boolean;
  completeness: boolean;
  originality: boolean;
  spoilerCeiling: boolean;
  provenance: boolean;
}>;

export type HoidHistoricalEditorialReviewPacket = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  workId: string;
  editionId: string;
  chapterNumber: number;
  declaredSpoilerCeilingChapter: number;
  summaryText: string;
  summarySha256: string;
  sourceEvidence: HoidHistoricalReviewSourceEvidence;
  checklist: HoidHistoricalEditorialChecklist;
  status: "pending-human-review";
  sourceTextIncluded: false;
  sourceTextPersisted: false;
  providerEgress: "none";
  promotionAllowed: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  spoilerAuthorization: "none";
}>;

export type HoidHistoricalEditorialReviewReceipt = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  summarySha256: string;
  sourceReceiptFingerprint: string;
  decision: "approved" | "revision-required" | "rejected";
  reviewerLabel: string;
  reviewerIdentityAuthority: "unverified-local-label";
  reviewedAt: string;
  checklist: HoidHistoricalEditorialChecklist;
  noteCodes: readonly HoidHistoricalEditorialReviewNoteCode[];
  trustLevel: "local-unverified";
  promotionAllowed: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  spoilerAuthorization: "none";
}>;

export type HoidHistoricalEditorialReviewNoteCode =
  | "no-issues"
  | "factual-issue"
  | "completeness-issue"
  | "originality-issue"
  | "spoiler-scope-issue"
  | "provenance-issue";

export type HoidHistoricalEditorialReviewPacketBuildResult =
  | Readonly<{ status: "ready"; packet: HoidHistoricalEditorialReviewPacket }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-draft"
        | "invalid-source-evidence"
        | "unknown-work"
        | "manifest-mismatch"
        | "chapter-not-uniquely-verifiable";
    }>;

export type HoidHistoricalEditorialReviewDecisionResult =
  | Readonly<{
      status: "valid";
      outcome:
        | "approved-awaiting-trusted-promotion"
        | "revision-required"
        | "rejected";
      receipt: HoidHistoricalEditorialReviewReceipt;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-packet"
        | "invalid-decision"
        | "packet-mismatch"
        | "invalid-reviewer"
        | "invalid-date"
        | "invalid-checklist"
        | "incomplete-approval";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const DRAFT_KEYS = new Set([
  "schemaVersion", "scope", "workId", "editionId", "chapterNumber",
  "summaryText", "originalityAttested", "reviewState", "sourceContentIncluded",
  "sourceTextPersisted", "productionWritePerformed", "authorizationEffect",
  "editorialEffect", "spoilerAuthorization",
]);
const EVIDENCE_KEYS = new Set([
  "receiptFingerprint", "documentSha256", "navigationSha256", "byteLength", "inspectedAt",
]);
const PACKET_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "workId", "editionId", "chapterNumber",
  "declaredSpoilerCeilingChapter", "summaryText", "summarySha256", "sourceEvidence",
  "checklist", "status", "sourceTextIncluded", "sourceTextPersisted", "providerEgress",
  "promotionAllowed", "productionWritePerformed", "authorizationEffect", "spoilerAuthorization",
]);
const DECISION_KEYS = new Set(["decision", "reviewerLabel", "reviewedAt", "checklist", "noteCodes"]);
const RECEIPT_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "summarySha256", "sourceReceiptFingerprint",
  "decision", "reviewerLabel", "reviewerIdentityAuthority", "reviewedAt", "checklist",
  "noteCodes", "trustLevel", "promotionAllowed", "productionWritePerformed",
  "authorizationEffect", "spoilerAuthorization",
]);
const CHECKLIST_KEYS = [
  "factualAccuracy", "completeness", "originality", "spoilerCeiling", "provenance",
] as const;
const NOTE_CODES = new Set<HoidHistoricalEditorialReviewNoteCode>([
  "no-issues",
  "factual-issue",
  "completeness-issue",
  "originality-issue",
  "spoiler-scope-issue",
  "provenance-issue",
]);

type DraftRecord = Readonly<{
  schemaVersion: 1;
  scope: "ephemeral-local-editorial-draft";
  workId: string;
  editionId: string;
  chapterNumber: number;
  summaryText: string;
  originalityAttested: true;
  reviewState: "awaiting-human-editorial-review";
  sourceContentIncluded: false;
  sourceTextPersisted: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  editorialEffect: "none";
  spoilerAuthorization: "none";
}>;

function exactRecord(value: unknown, keys: ReadonlySet<string>): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 24) return false;
  try {
    return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function canonicalEvidence(value: unknown): HoidHistoricalReviewSourceEvidence | null {
  const raw = exactRecord(value, EVIDENCE_KEYS);
  if (!raw || !isSha256(raw.receiptFingerprint) || !isSha256(raw.documentSha256) ||
      !isSha256(raw.navigationSha256) || typeof raw.byteLength !== "number" ||
      !Number.isSafeInteger(raw.byteLength) || raw.byteLength < 1 ||
      raw.byteLength > HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes ||
      !canonicalIso(raw.inspectedAt)) return null;
  return Object.freeze({
    receiptFingerprint: raw.receiptFingerprint,
    documentSha256: raw.documentSha256,
    navigationSha256: raw.navigationSha256,
    byteLength: raw.byteLength,
    inspectedAt: raw.inspectedAt,
  });
}

function emptyChecklist(): HoidHistoricalEditorialChecklist {
  return Object.freeze({
    factualAccuracy: false,
    completeness: false,
    originality: false,
    spoilerCeiling: false,
    provenance: false,
  });
}

function canonicalChecklist(value: unknown): HoidHistoricalEditorialChecklist | null {
  const raw = exactRecord(value, new Set(CHECKLIST_KEYS));
  if (!raw || CHECKLIST_KEYS.some(key => typeof raw[key] !== "boolean")) return null;
  return Object.freeze({
    factualAccuracy: raw.factualAccuracy as boolean,
    completeness: raw.completeness as boolean,
    originality: raw.originality as boolean,
    spoilerCeiling: raw.spoilerCeiling as boolean,
    provenance: raw.provenance as boolean,
  });
}

function checklistValues(value: HoidHistoricalEditorialChecklist): readonly boolean[] {
  return Object.freeze(CHECKLIST_KEYS.map(key => value[key]));
}

function allChecksPassed(value: HoidHistoricalEditorialChecklist): boolean {
  return checklistValues(value).every(Boolean);
}

function packetPayload(packet: Omit<HoidHistoricalEditorialReviewPacket, "packetId">): string {
  return JSON.stringify([
    "hoid-historical-editorial-review-v1",
    packet.draftId,
    packet.workId,
    packet.editionId,
    packet.chapterNumber,
    packet.declaredSpoilerCeilingChapter,
    packet.summarySha256,
    packet.sourceEvidence.receiptFingerprint,
    packet.sourceEvidence.documentSha256,
    packet.sourceEvidence.navigationSha256,
    packet.sourceEvidence.byteLength,
    packet.sourceEvidence.inspectedAt,
  ]);
}

function packetId(packet: Omit<HoidHistoricalEditorialReviewPacket, "packetId">): string {
  return sha256Hex(packetPayload(packet));
}

function canonicalPacket(value: unknown): HoidHistoricalEditorialReviewPacket | null {
  const raw = exactRecord(value, PACKET_KEYS);
  if (!raw || raw.schemaVersion !== 1 || raw.status !== "pending-human-review" ||
      raw.sourceTextIncluded !== false || raw.sourceTextPersisted !== false ||
      raw.providerEgress !== "none" || raw.promotionAllowed !== false ||
      raw.productionWritePerformed !== false || raw.authorizationEffect !== "none" ||
      raw.spoilerAuthorization !== "none") return null;

  const evidence = canonicalEvidence(raw.sourceEvidence);
  const checklist = canonicalChecklist(raw.checklist);
  if (!evidence || !checklist || checklistValues(checklist).some(Boolean)) return null;

  if (typeof raw.workId !== "string" ||
      !HOID_SOURCE_BIBLIOGRAPHY.some(work => work.id === raw.workId) ||
      typeof raw.editionId !== "string" ||
      typeof raw.chapterNumber !== "number" || !Number.isSafeInteger(raw.chapterNumber) ||
      raw.chapterNumber < 1 || raw.declaredSpoilerCeilingChapter !== raw.chapterNumber ||
      typeof raw.summaryText !== "string" ||
      raw.summaryText !== raw.summaryText.trim() ||
      raw.summaryText.length < 80 || raw.summaryText.length > 3_000 ||
      /[\u0000-\u001f\u007f]/u.test(raw.summaryText) ||
      /<(?:!doctype|html|body|script|style)\b/i.test(raw.summaryText) ||
      /(?:file|content):\/\//i.test(raw.summaryText) ||
      !isSha256(raw.summarySha256) || raw.summarySha256 !== sha256Hex(raw.summaryText) ||
      typeof raw.draftId !== "string" || !/^local:[a-f0-9]{64}$/.test(raw.draftId) ||
      !isSha256(raw.packetId)) return null;

  const manifestResult = getHoidReadingManifest(raw.workId);
  if (manifestResult.status !== "ready" ||
      manifestResult.manifest.editionId !== raw.editionId ||
      manifestResult.manifest.navigationSha256 !== evidence.navigationSha256) return null;
  const units = manifestResult.manifest.units.filter(unit =>
    unit.chapterNumber === raw.chapterNumber && typeof unit.locatorId === "string",
  );
  if (units.length !== 1) return null;

  const payload = {
    schemaVersion: 1 as const,
    draftId: raw.draftId,
    workId: raw.workId,
    editionId: raw.editionId,
    chapterNumber: raw.chapterNumber,
    declaredSpoilerCeilingChapter: raw.chapterNumber,
    summaryText: raw.summaryText,
    summarySha256: raw.summarySha256,
    sourceEvidence: evidence,
    checklist,
    status: "pending-human-review" as const,
    sourceTextIncluded: false as const,
    sourceTextPersisted: false as const,
    providerEgress: "none" as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
    authorizationEffect: "none" as const,
    spoilerAuthorization: "none" as const,
  };
  if (packetId(payload) !== raw.packetId) return null;
  return Object.freeze({ ...payload, packetId: raw.packetId });
}

/**
 * Builds a local-only review packet from a controller-issued, source-bound
 * draft and its validated inspection receipt metadata. This packet is not a
 * production claim and cannot authorize spoilers or provider egress.
 */
export function buildHoidHistoricalEditorialReviewPacket(
  draftInput: unknown,
  evidenceInput: unknown,
): HoidHistoricalEditorialReviewPacketBuildResult {
  const draft = exactRecord(draftInput, DRAFT_KEYS);
  if (!draft || draft.schemaVersion !== 1 ||
      draft.scope !== "ephemeral-local-editorial-draft" ||
      draft.originalityAttested !== true ||
      draft.reviewState !== "awaiting-human-editorial-review" ||
      draft.sourceContentIncluded !== false || draft.sourceTextPersisted !== false ||
      draft.productionWritePerformed !== false ||
      draft.authorizationEffect !== "none" || draft.editorialEffect !== "none" ||
      draft.spoilerAuthorization !== "none" ||
      typeof draft.workId !== "string" || typeof draft.editionId !== "string" ||
      typeof draft.chapterNumber !== "number" || !Number.isSafeInteger(draft.chapterNumber) ||
      draft.chapterNumber < 1 || typeof draft.summaryText !== "string" ||
      draft.summaryText !== draft.summaryText.trim() ||
      draft.summaryText.length < 80 || draft.summaryText.length > 3_000 ||
      /[\u0000-\u001f\u007f]/u.test(draft.summaryText) ||
      /<(?:!doctype|html|body|script|style)\b/i.test(draft.summaryText) ||
      /(?:file|content):\/\//i.test(draft.summaryText)) {
    return Object.freeze({ status: "invalid", reason: "invalid-draft" });
  }
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === draft.workId);
  if (!work) return Object.freeze({ status: "invalid", reason: "unknown-work" });
  const manifestResult = getHoidReadingManifest(draft.workId);
  if (manifestResult.status !== "ready" || manifestResult.manifest.editionId !== draft.editionId) {
    return Object.freeze({ status: "invalid", reason: "manifest-mismatch" });
  }
  const units = manifestResult.manifest.units.filter(unit =>
    unit.chapterNumber === draft.chapterNumber && typeof unit.locatorId === "string",
  );
  if (units.length !== 1) {
    return Object.freeze({ status: "invalid", reason: "chapter-not-uniquely-verifiable" });
  }
  const evidence = canonicalEvidence(evidenceInput);
  if (!evidence || evidence.navigationSha256 !== manifestResult.manifest.navigationSha256) {
    return Object.freeze({ status: "invalid", reason: "invalid-source-evidence" });
  }

  const summaryText = draft.summaryText;
  const summarySha256 = sha256Hex(summaryText);
  const draftId = "local:" + sha256Hex(JSON.stringify([
    "hoid-local-editorial-draft-v1",
    draft.workId,
    draft.editionId,
    draft.chapterNumber,
    evidence.receiptFingerprint,
    summarySha256,
  ]));
  const base = {
    schemaVersion: 1 as const,
    draftId,
    workId: draft.workId,
    editionId: draft.editionId,
    chapterNumber: draft.chapterNumber,
    declaredSpoilerCeilingChapter: draft.chapterNumber,
    summaryText,
    summarySha256,
    sourceEvidence: evidence,
    checklist: emptyChecklist(),
    status: "pending-human-review" as const,
    sourceTextIncluded: false as const,
    sourceTextPersisted: false as const,
    providerEgress: "none" as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
    authorizationEffect: "none" as const,
    spoilerAuthorization: "none" as const,
  };
  const packet = Object.freeze({ ...base, packetId: packetId(base) });
  const validation = validateHoidHistoricalEditorialReviewPacket(packet);
  return validation.status === "valid"
    ? Object.freeze({ status: "ready", packet: validation.packet })
    : Object.freeze({ status: "invalid", reason: "invalid-source-evidence" });
}

export function validateHoidHistoricalEditorialReviewPacket(
  value: unknown,
): Readonly<{ status: "valid"; packet: HoidHistoricalEditorialReviewPacket }> |
Readonly<{ status: "invalid"; reason: "invalid-packet" }> {
  const packet = canonicalPacket(value);
  return packet
    ? Object.freeze({ status: "valid", packet })
    : Object.freeze({ status: "invalid", reason: "invalid-packet" });
}

function canonicalNoteCodes(value: unknown): readonly HoidHistoricalEditorialReviewNoteCode[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > 6 ||
        Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const seen = new Set<string>();
    const result: HoidHistoricalEditorialReviewNoteCode[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true || typeof descriptor.value !== "string" ||
          !NOTE_CODES.has(descriptor.value as HoidHistoricalEditorialReviewNoteCode) ||
          seen.has(descriptor.value)) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value as HoidHistoricalEditorialReviewNoteCode);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

/** A local reviewer label is not an authenticated identity or a trusted signature. */
export function validateHoidHistoricalEditorialReviewDecision(
  packetInput: unknown,
  decisionInput: unknown,
): HoidHistoricalEditorialReviewDecisionResult {
  const packet = canonicalPacket(packetInput);
  if (!packet) {
    return Object.freeze({ status: "invalid", reason: "invalid-packet", promotionAllowed: false, productionWritePerformed: false });
  }
  const raw = exactRecord(decisionInput, DECISION_KEYS);
  if (!raw) {
    return Object.freeze({ status: "invalid", reason: "invalid-decision", promotionAllowed: false, productionWritePerformed: false });
  }
  if (raw.decision !== "approved" && raw.decision !== "revision-required" && raw.decision !== "rejected") {
    return Object.freeze({ status: "invalid", reason: "invalid-decision", promotionAllowed: false, productionWritePerformed: false });
  }
  if (typeof raw.reviewerLabel !== "string" ||
      !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/i.test(raw.reviewerLabel)) {
    return Object.freeze({ status: "invalid", reason: "invalid-reviewer", promotionAllowed: false, productionWritePerformed: false });
  }
  if (!canonicalIso(raw.reviewedAt)) {
    return Object.freeze({ status: "invalid", reason: "invalid-date", promotionAllowed: false, productionWritePerformed: false });
  }
  const checklist = canonicalChecklist(raw.checklist);
  const noteCodes = canonicalNoteCodes(raw.noteCodes);
  if (!checklist || !noteCodes) {
    return Object.freeze({ status: "invalid", reason: "invalid-checklist", promotionAllowed: false, productionWritePerformed: false });
  }
  if (raw.decision === "approved" &&
      (!allChecksPassed(checklist) || noteCodes.length !== 1 || noteCodes[0] !== "no-issues")) {
    return Object.freeze({ status: "invalid", reason: "incomplete-approval", promotionAllowed: false, productionWritePerformed: false });
  }
  if (raw.decision !== "approved" && noteCodes.includes("no-issues")) {
    return Object.freeze({ status: "invalid", reason: "invalid-checklist", promotionAllowed: false, productionWritePerformed: false });
  }

  const receipt: HoidHistoricalEditorialReviewReceipt = Object.freeze({
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceReceiptFingerprint: packet.sourceEvidence.receiptFingerprint,
    decision: raw.decision,
    reviewerLabel: raw.reviewerLabel.trim(),
    reviewerIdentityAuthority: "unverified-local-label",
    reviewedAt: raw.reviewedAt,
    checklist,
    noteCodes,
    trustLevel: "local-unverified",
    promotionAllowed: false,
    productionWritePerformed: false,
    authorizationEffect: "none",
    spoilerAuthorization: "none",
  });
  const outcome = raw.decision === "approved"
    ? "approved-awaiting-trusted-promotion"
    : raw.decision === "revision-required" ? "revision-required" : "rejected";
  return Object.freeze({
    status: "valid",
    outcome,
    receipt,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

export function validateHoidHistoricalEditorialReviewReceipt(
  packetInput: unknown,
  receiptInput: unknown,
): HoidHistoricalEditorialReviewDecisionResult {
  const packet = canonicalPacket(packetInput);
  const raw = exactRecord(receiptInput, RECEIPT_KEYS);
  if (!packet) {
    return Object.freeze({ status: "invalid", reason: "invalid-packet", promotionAllowed: false, productionWritePerformed: false });
  }
  if (!raw || raw.schemaVersion !== 1 || raw.packetId !== packet.packetId ||
      raw.draftId !== packet.draftId || raw.summarySha256 !== packet.summarySha256 ||
      raw.sourceReceiptFingerprint !== packet.sourceEvidence.receiptFingerprint) {
    return Object.freeze({ status: "invalid", reason: "packet-mismatch", promotionAllowed: false, productionWritePerformed: false });
  }
  const decisionInput = {
    decision: raw.decision,
    reviewerLabel: raw.reviewerLabel,
    reviewedAt: raw.reviewedAt,
    checklist: raw.checklist,
    noteCodes: raw.noteCodes,
  };
  const validated = validateHoidHistoricalEditorialReviewDecision(packet, decisionInput);
  if (validated.status !== "valid") return validated;
  if (raw.reviewerIdentityAuthority !== "unverified-local-label" ||
      raw.trustLevel !== "local-unverified" || raw.promotionAllowed !== false ||
      raw.productionWritePerformed !== false || raw.authorizationEffect !== "none" ||
      raw.spoilerAuthorization !== "none") {
    return Object.freeze({ status: "invalid", reason: "packet-mismatch", promotionAllowed: false, productionWritePerformed: false });
  }
  return validated;
}

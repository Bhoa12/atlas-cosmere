import type {
  HoidEditorialSourceDocumentAccessPort,
  HoidEditorialSourceDocumentAccessRequest,
} from "./editorialClaimPromotionPreflight";
import {
  HOID_EPUB_INGESTION_LIMITS,
  type HoidEpubPackageInspectionCandidate,
} from "./epubIngestion";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { getVerifiedChapterLocatorId } from "./verifiedChapterLocators";

const MAX_ACTIVE_SOURCE_SESSIONS = 32;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const WORK_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

const PACKAGE_CANDIDATE_KEYS = Object.freeze([
  "status",
  "sourceId",
  "workId",
  "declaredEditionId",
  "sourceGroup",
  "editionBinding",
  "packageVersion",
  "title",
  "language",
  "uniqueIdentifier",
  "archiveEntryCount",
  "manifestItemCount",
  "spineItemCount",
  "navigationEntryCount",
  "navigationXhtmlTargetCount",
  "archiveInventorySha256",
  "mimetypeSha256",
  "containerDocumentSha256",
  "packageDocumentSha256",
  "navigationDocumentSha256",
  "sourceFingerprint",
] as const);

const CHAPTER_CANDIDATE_KEYS = Object.freeze([
  "status",
  "workId",
  "declaredEditionId",
  "sourceGroup",
  "navigationHref",
  "byteLength",
  "documentSha256",
  "navigationDocumentSha256",
  "packageSourceFingerprint",
  "candidateFingerprint",
] as const);

type BoundSession = Readonly<{
  workId: string;
  sourceId: string;
  editionId: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  navigationSha256: string;
  sourceFingerprint: string;
  packageCandidate: HoidEpubPackageInspectionCandidate;
  inspectChapterDocument: (
    candidate: unknown,
    href: unknown,
    signal?: AbortSignal,
  ) => Promise<unknown>;
  isCurrent: () => boolean;
}>;

export type HoidEpubEditorialSourceAccessRouterResult =
  | Readonly<{
      status: "ready";
      port: HoidEditorialSourceDocumentAccessPort;
      activeWorkCount: number;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-sessions" | "empty-sessions" | "duplicate-work";
    }>;

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
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

function safeOwnFunction<T>(
  value: unknown,
  name: string,
): T | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      typeof descriptor.value !== "function"
    ) return null;
    return descriptor.value.bind(value) as T;
  } catch {
    return null;
  }
}

function denseSessionList(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length === 0 ||
      value.length > MAX_ACTIVE_SOURCE_SESSIONS
    ) return null;
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

function safeRelativeChapterHref(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > 2048 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("%") ||
    value.includes(":") ||
    value.includes("?") ||
    value.includes("#") ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    !/^[A-Za-z0-9._/-]+$/u.test(value) ||
    !/\.(?:xhtml|html)$/iu.test(value)
  ) return false;
  const segments = value.split("/");
  return segments.every(segment =>
    segment.length > 0 && segment !== "." && segment !== "..",
  );
}

function isCurrent(session: BoundSession): boolean {
  try {
    return session.isCurrent() === true;
  } catch {
    return false;
  }
}

function unavailable(reason: string): Readonly<{
  status: "unavailable";
  reason: string;
}> {
  return Object.freeze({ status: "unavailable", reason });
}

function bindSession(value: unknown): BoundSession | null {
  const raw = exactDataRecord(value, [
    "sourceId",
    "packageCandidate",
    "ingestion",
    "isCurrent",
  ]);
  if (!raw) return null;

  const sourceId = raw.sourceId;
  if (typeof sourceId !== "string" || !SOURCE_ID_PATTERN.test(sourceId)) return null;

  const packageCandidate = raw.packageCandidate;
  if (
    packageCandidate === null ||
    typeof packageCandidate !== "object" ||
    Array.isArray(packageCandidate)
  ) return null;
  try {
    if (!Object.isFrozen(packageCandidate)) return null;
  } catch {
    return null;
  }
  const candidate = exactDataRecord(packageCandidate, PACKAGE_CANDIDATE_KEYS);
  if (!candidate) return null;

  if (
    candidate.status !== "candidate-only" ||
    candidate.sourceId !== sourceId ||
    typeof candidate.workId !== "string" ||
    !WORK_ID_PATTERN.test(candidate.workId) ||
    typeof candidate.declaredEditionId !== "string" ||
    candidate.editionBinding !== "catalogue-navigation-digest-match" ||
    (candidate.sourceGroup !== "cosmere.epub" && candidate.sourceGroup !== "roshar-epubs") ||
    typeof candidate.navigationDocumentSha256 !== "string" ||
    !SHA256_PATTERN.test(candidate.navigationDocumentSha256) ||
    typeof candidate.sourceFingerprint !== "string" ||
    !SHA256_PATTERN.test(candidate.sourceFingerprint)
  ) return null;

  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === candidate.workId);
  const manifestResult = getHoidReadingManifest(candidate.workId);
  if (
    !work ||
    work.sourceGroup !== candidate.sourceGroup ||
    manifestResult.status !== "ready" ||
    manifestResult.manifest.editionId !== candidate.declaredEditionId ||
    manifestResult.manifest.navigationSha256 !== candidate.navigationDocumentSha256
  ) return null;

  const inspectChapterDocument = safeOwnFunction<BoundSession["inspectChapterDocument"]>(
    raw.ingestion,
    "inspectChapterDocument",
  );
  const isCurrentFunction = typeof raw.isCurrent === "function"
    ? raw.isCurrent as () => boolean
    : null;
  if (!inspectChapterDocument || !isCurrentFunction) return null;

  return Object.freeze({
    workId: candidate.workId,
    sourceId,
    editionId: candidate.declaredEditionId,
    sourceGroup: candidate.sourceGroup,
    navigationSha256: candidate.navigationDocumentSha256,
    sourceFingerprint: candidate.sourceFingerprint,
    packageCandidate: packageCandidate as HoidEpubPackageInspectionCandidate,
    inspectChapterDocument: inspectChapterDocument as BoundSession["inspectChapterDocument"],
    isCurrent: isCurrentFunction,
  });
}

function hrefFromVerifiedLocator(
  locatorId: string,
  editionId: string,
  navigationSha256: string,
): string | null {
  const prefix = `nav:${editionId}:${navigationSha256}:`;
  if (!locatorId.startsWith(prefix)) return null;
  const href = locatorId.slice(prefix.length);
  return safeRelativeChapterHref(href) ? href : null;
}

function requestRecord(
  value: unknown,
): HoidEditorialSourceDocumentAccessRequest | null {
  const raw = exactDataRecord(value, [
    "bookId",
    "editionId",
    "navigationSha256",
    "chapterNumber",
    "locatorId",
    "expectedDocumentSha256",
  ]);
  if (
    !raw ||
    typeof raw.bookId !== "string" ||
    !WORK_ID_PATTERN.test(raw.bookId) ||
    typeof raw.editionId !== "string" ||
    typeof raw.navigationSha256 !== "string" ||
    !SHA256_PATTERN.test(raw.navigationSha256) ||
    typeof raw.chapterNumber !== "number" ||
    !Number.isSafeInteger(raw.chapterNumber) ||
    raw.chapterNumber < 1 ||
    typeof raw.locatorId !== "string" ||
    raw.locatorId.length > 4096 ||
    typeof raw.expectedDocumentSha256 !== "string" ||
    !SHA256_PATTERN.test(raw.expectedDocumentSha256)
  ) return null;

  return raw as unknown as HoidEditorialSourceDocumentAccessRequest;
}

function validChapterCandidate(
  value: unknown,
  session: BoundSession,
  href: string,
  expectedDocumentSha256: string,
): boolean {
  const candidate = exactDataRecord(value, CHAPTER_CANDIDATE_KEYS);
  if (!candidate) return false;
  return (
    candidate.status === "candidate-only" &&
    candidate.workId === session.workId &&
    candidate.declaredEditionId === session.editionId &&
    candidate.sourceGroup === session.sourceGroup &&
    candidate.navigationHref === href &&
    typeof candidate.byteLength === "number" &&
    Number.isSafeInteger(candidate.byteLength) &&
    candidate.byteLength > 0 &&
    candidate.byteLength <= HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes &&
    candidate.documentSha256 === expectedDocumentSha256 &&
    candidate.navigationDocumentSha256 === session.navigationSha256 &&
    candidate.packageSourceFingerprint === session.sourceFingerprint &&
    typeof candidate.candidateFingerprint === "string" &&
    SHA256_PATTERN.test(candidate.candidateFingerprint)
  );
}

async function inspectBoundSession(
  session: BoundSession,
  request: HoidEditorialSourceDocumentAccessRequest,
  signal: AbortSignal,
): Promise<Readonly<{ status: "available"; documentSha256: string }> | Readonly<{
  status: "unavailable";
  reason: string;
}>> {
  try {
    if (signal.aborted || !isCurrent(session)) return unavailable("source-session-stale");
    if (
      request.bookId !== session.workId ||
      request.editionId !== session.editionId ||
      request.navigationSha256 !== session.navigationSha256
    ) return unavailable("source-session-mismatch");

    const manifestResult = getHoidReadingManifest(request.bookId);
    if (manifestResult.status !== "ready") return unavailable("source-not-registered");
    const manifest = manifestResult.manifest;
    if (
      manifest.editionId !== request.editionId ||
      manifest.navigationSha256 !== request.navigationSha256
    ) return unavailable("source-edition-mismatch");

    const locatorId = getVerifiedChapterLocatorId(
      request.bookId,
      request.editionId,
      request.navigationSha256,
      request.chapterNumber,
    );
    if (locatorId === null || locatorId !== request.locatorId) {
      return unavailable("chapter-locator-mismatch");
    }

    const units = manifest.units.filter(unit =>
      unit.chapterNumber === request.chapterNumber &&
      unit.locatorId === request.locatorId,
    );
    if (units.length !== 1) return unavailable("chapter-locator-ambiguous");

    const expectedDigest = getVerifiedChapterDocumentSha256(
      request.bookId,
      request.editionId,
      request.navigationSha256,
      request.chapterNumber,
    );
    if (expectedDigest === null || expectedDigest !== request.expectedDocumentSha256) {
      return unavailable("chapter-document-not-allowlisted");
    }

    const href = hrefFromVerifiedLocator(
      request.locatorId,
      request.editionId,
      request.navigationSha256,
    );
    if (href === null) return unavailable("chapter-locator-unsafe");

    const rawResult = await session.inspectChapterDocument(
      session.packageCandidate,
      href,
      signal,
    );
    if (signal.aborted || !isCurrent(session)) return unavailable("source-session-stale");

    const result = exactDataRecord(rawResult, ["status", "candidate"]);
    if (
      !result ||
      result.status !== "candidate" ||
      !validChapterCandidate(result.candidate, session, href, expectedDigest)
    ) return unavailable("source-inspection-rejected");

    return Object.freeze({
      status: "available",
      documentSha256: expectedDigest,
    });
  } catch {
    return unavailable("source-inspection-failed");
  }
}

/**
 * Compose active, host-local EPUB inspection sessions into the metadata-only
 * source port consumed by editorial promotion preflight.
 *
 * Each session is tied to one immutable package candidate and one work ID.
 * A multi-work EPUB may therefore be represented by several sessions sharing
 * the same ephemeral source ID but retaining distinct package candidates.
 * The port never returns bytes, XHTML, extracted blocks, titles or file URIs.
 */
export function createHoidEpubEditorialSourceAccessRouter(
  sessionsInput: unknown,
): HoidEpubEditorialSourceAccessRouterResult {
  const sessionList = denseSessionList(sessionsInput);
  if (sessionList === null) {
    return Object.freeze({ status: "unavailable", reason: "invalid-sessions" });
  }

  const sessions = new Map<string, BoundSession>();
  for (const raw of sessionList) {
    const session = bindSession(raw);
    if (!session) return Object.freeze({ status: "unavailable", reason: "invalid-sessions" });
    if (sessions.has(session.workId)) {
      return Object.freeze({ status: "unavailable", reason: "duplicate-work" });
    }
    sessions.set(session.workId, session);
  }

  const port: HoidEditorialSourceDocumentAccessPort = Object.freeze({
    async inspectChapter(
      requestInput: HoidEditorialSourceDocumentAccessRequest,
      options: Readonly<{ signal: AbortSignal }>,
    ) {
      const request = requestRecord(requestInput);
      const optionsRecord = exactDataRecord(options, ["signal"]);
      const signal = optionsRecord?.signal;
      if (
        !request ||
        signal === null ||
        typeof signal !== "object" ||
        typeof (signal as AbortSignal).aborted !== "boolean"
      ) return unavailable("invalid-request");

      const session = sessions.get(request.bookId);
      if (!session) return unavailable("source-not-loaded");
      return inspectBoundSession(session, request, signal as AbortSignal);
    },
  });

  return Object.freeze({
    status: "ready",
    port,
    activeWorkCount: sessions.size,
  });
}

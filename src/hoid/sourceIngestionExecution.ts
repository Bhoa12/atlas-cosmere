import { createHoidEpubSourceDescriptor } from "./epubImportSelection";
import { HOID_EPUB_INGESTION_LIMITS, type HoidEpubIngestionService, type HoidEpubInspectionRejection } from "./epubIngestion";
import { getHoidReadingManifest } from "./readingManifest";
import { getHoidSourceIngestionPlan } from "./sourceIngestionPlan";

type HoidSourceIngestionTask = ReturnType<typeof getHoidSourceIngestionPlan>["tasks"][number];

export type HoidPlannedChapterInspectionCandidate = Readonly<{
  schemaVersion: 1;
  status: "candidate-only";
  workId: string;
  title: string;
  chapterNumber: number;
  editionId: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  locatorId: string;
  navigationHref: string;
  byteLength: number;
  documentSha256: string;
  navigationSha256: string;
  packageSourceFingerprint: string;
  candidateFingerprint: string;
  minimumReaderChapter: number;
  authorizationEffect: "none";
  editorialEffect: "none";
  summaryCreated: false;
  productionWritePerformed: false;
}>;

export type HoidSourceIngestionExecutionRejection =
  | "invalid-task" | "invalid-source-descriptor" | "source-candidate-mismatch"
  | "manifest-mismatch" | "chapter-candidate-mismatch" | HoidEpubInspectionRejection;

export type HoidSourceIngestionExecutionResult =
  | Readonly<{ status: "candidate"; candidate: HoidPlannedChapterInspectionCandidate }>
  | Readonly<{ status: "rejected"; reason: HoidSourceIngestionExecutionRejection }>;

const TASK_KEYS = [
  "workId", "title", "sourceGroup", "editionId", "chapterNumber", "locatorId",
  "navigationHref", "manifestCoverage", "safeChapterCount", "inspectedChapterCount",
  "priority", "status", "sourceAvailability", "requiresExplicitSourceSelection",
  "minimumReaderChapter", "scope",
] as const;
const SOURCE_KEYS = ["sourceId", "workId", "editionId", "sourceGroup"] as const;
const PACKAGE_KEYS = [
  "status", "sourceId", "workId", "declaredEditionId", "sourceGroup", "editionBinding",
  "packageVersion", "title", "language", "uniqueIdentifier", "archiveEntryCount",
  "manifestItemCount", "spineItemCount", "navigationEntryCount", "navigationXhtmlTargetCount",
  "archiveInventorySha256", "mimetypeSha256", "containerDocumentSha256",
  "packageDocumentSha256", "navigationDocumentSha256", "sourceFingerprint",
] as const;
const CHAPTER_KEYS = [
  "status", "workId", "declaredEditionId", "sourceGroup", "navigationHref", "byteLength",
  "documentSha256", "navigationDocumentSha256", "packageSourceFingerprint", "candidateFingerprint",
] as const;

function exactDataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return null;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return null;
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function reject(reason: HoidSourceIngestionExecutionRejection): HoidSourceIngestionExecutionResult {
  return Object.freeze({ status: "rejected", reason });
}

function resolveCurrentTask(value: unknown): HoidSourceIngestionTask | null {
  const record = exactDataRecord(value, TASK_KEYS);
  if (record === null) return null;
  const current = getHoidSourceIngestionPlan().tasks.find(task => task.workId === record.workId && task.chapterNumber === record.chapterNumber);
  if (current === undefined) return null;
  return TASK_KEYS.every(key => record[key] === current[key]) ? current : null;
}

export async function inspectHoidPlannedChapterCandidate(
  taskInput: unknown,
  sourceInput: unknown,
  packageCandidateInput: unknown,
  ingestion: HoidEpubIngestionService,
): Promise<HoidSourceIngestionExecutionResult> {
  const task = resolveCurrentTask(taskInput);
  if (task === null) return reject("invalid-task");

  const sourceRecord = exactDataRecord(sourceInput, SOURCE_KEYS);
  if (sourceRecord === null) return reject("invalid-source-descriptor");
  const descriptor = createHoidEpubSourceDescriptor(sourceRecord.sourceId, sourceRecord.workId, sourceRecord.editionId);
  if (descriptor === null || sourceRecord.sourceGroup !== descriptor.sourceGroup ||
      descriptor.workId !== task.workId || descriptor.editionId !== task.editionId ||
      descriptor.sourceGroup !== task.sourceGroup) return reject("invalid-source-descriptor");

  const manifestResult = getHoidReadingManifest(task.workId);
  if (manifestResult.status !== "ready") return reject("manifest-mismatch");
  const manifest = manifestResult.manifest;
  const unit = manifest.units.find(item => item.chapterNumber === task.chapterNumber);
  const expectedLocator = `nav:${manifest.editionId}:${manifest.navigationSha256}:${task.navigationHref}`;
  if (manifest.editionId !== task.editionId || unit === undefined ||
      unit.locatorId !== task.locatorId || task.locatorId !== expectedLocator ||
      task.minimumReaderChapter !== task.chapterNumber + 1 ||
      task.safeChapterCount !== manifest.units.length ||
      task.requiresExplicitSourceSelection !== true ||
      task.sourceAvailability !== "not-checked" ||
      task.status !== "awaiting-explicit-local-source-selection") return reject("manifest-mismatch");

  const packageRecord = exactDataRecord(packageCandidateInput, PACKAGE_KEYS);
  if (packageRecord === null || packageRecord.status !== "candidate-only" ||
      packageRecord.sourceId !== descriptor.sourceId || packageRecord.workId !== task.workId ||
      packageRecord.declaredEditionId !== task.editionId || packageRecord.sourceGroup !== task.sourceGroup ||
      packageRecord.editionBinding !== "catalogue-navigation-digest-match" ||
      packageRecord.navigationDocumentSha256 !== manifest.navigationSha256 ||
      !isSha256(packageRecord.archiveInventorySha256) || !isSha256(packageRecord.mimetypeSha256) ||
      !isSha256(packageRecord.containerDocumentSha256) || !isSha256(packageRecord.packageDocumentSha256) ||
      !isSha256(packageRecord.navigationDocumentSha256) || !isSha256(packageRecord.sourceFingerprint)) {
    return reject("source-candidate-mismatch");
  }

  let chapterResult;
  try {
    chapterResult = await ingestion.inspectChapterDocument(packageCandidateInput, task.navigationHref);
  } catch {
    return reject("inspection-failed");
  }
  if (chapterResult.status === "rejected") return reject(chapterResult.reason);

  const chapterRecord = exactDataRecord(chapterResult.candidate, CHAPTER_KEYS);
  if (chapterRecord === null || chapterRecord.status !== "candidate-only" ||
      chapterRecord.workId !== task.workId || chapterRecord.declaredEditionId !== task.editionId ||
      chapterRecord.sourceGroup !== task.sourceGroup || chapterRecord.navigationHref !== task.navigationHref ||
      chapterRecord.navigationDocumentSha256 !== manifest.navigationSha256 ||
      chapterRecord.packageSourceFingerprint !== packageRecord.sourceFingerprint ||
      !Number.isSafeInteger(chapterRecord.byteLength) || (chapterRecord.byteLength as number) <= 0 ||
      (chapterRecord.byteLength as number) > HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes ||
      !isSha256(chapterRecord.documentSha256) || !isSha256(chapterRecord.candidateFingerprint)) {
    return reject("chapter-candidate-mismatch");
  }

  return Object.freeze({
    status: "candidate",
    candidate: Object.freeze({
      schemaVersion: 1, status: "candidate-only", workId: task.workId, title: task.title,
      chapterNumber: task.chapterNumber, editionId: task.editionId, sourceGroup: task.sourceGroup,
      locatorId: task.locatorId, navigationHref: task.navigationHref,
      byteLength: chapterRecord.byteLength as number,
      documentSha256: chapterRecord.documentSha256 as string,
      navigationSha256: manifest.navigationSha256,
      packageSourceFingerprint: packageRecord.sourceFingerprint as string,
      candidateFingerprint: chapterRecord.candidateFingerprint as string,
      minimumReaderChapter: task.minimumReaderChapter,
      authorizationEffect: "none", editorialEffect: "none",
      summaryCreated: false, productionWritePerformed: false,
    }),
  });
}

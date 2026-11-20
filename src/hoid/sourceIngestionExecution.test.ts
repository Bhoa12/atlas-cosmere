import { describe, expect, it, vi } from "vitest";
import { createHoidEpubSourceDescriptor } from "./epubImportSelection";
import type { HoidEpubIngestionService, HoidEpubPackageInspectionCandidate, HoidEpubChapterInspectionCandidate } from "./epubIngestion";
import { getHoidReadingManifest } from "./readingManifest";
import { getHoidSourceIngestionPlan } from "./sourceIngestionPlan";
import { inspectHoidPlannedChapterCandidate } from "./sourceIngestionExecution";

function fixture(chapterResult?: unknown) {
  const task = getHoidSourceIngestionPlan().tasks.find(item => item.workId === "tfe");
  if (!task) throw new Error("No hay tarea TFE disponible");
  const manifestResult = getHoidReadingManifest(task.workId);
  if (manifestResult.status !== "ready") throw new Error("Manifiesto TFE no disponible");
  const manifest = manifestResult.manifest;
  const descriptor = createHoidEpubSourceDescriptor("fixture-local-source", task.workId, task.editionId);
  if (!descriptor) throw new Error("Descriptor TFE no disponible");
  const packageCandidate: HoidEpubPackageInspectionCandidate = Object.freeze({
    status: "candidate-only", sourceId: descriptor.sourceId, workId: task.workId,
    declaredEditionId: task.editionId, sourceGroup: task.sourceGroup,
    editionBinding: "catalogue-navigation-digest-match", packageVersion: "3.0",
    title: "Fixture EPUB", language: "es", uniqueIdentifier: "urn:hoid:test",
    archiveEntryCount: 12, manifestItemCount: 8, spineItemCount: 6,
    navigationEntryCount: 4, navigationXhtmlTargetCount: 4,
    archiveInventorySha256: "a".repeat(64), mimetypeSha256: "b".repeat(64),
    containerDocumentSha256: "c".repeat(64), packageDocumentSha256: "d".repeat(64),
    navigationDocumentSha256: manifest.navigationSha256, sourceFingerprint: "e".repeat(64),
  });
  const chapterCandidate: HoidEpubChapterInspectionCandidate = Object.freeze({
    status: "candidate-only", workId: task.workId, declaredEditionId: task.editionId,
    sourceGroup: task.sourceGroup, navigationHref: task.navigationHref, byteLength: 2048,
    documentSha256: "f".repeat(64), navigationDocumentSha256: manifest.navigationSha256,
    packageSourceFingerprint: packageCandidate.sourceFingerprint, candidateFingerprint: "1".repeat(64),
  });
  const result = chapterResult ?? { status: "candidate" as const, candidate: chapterCandidate };
  const ingestion = {
    inspectPackage: vi.fn(async () => ({ status: "rejected" as const, reason: "inspection-failed" as const })),
    inspectChapterDocument: vi.fn(async () => result),
  } as unknown as HoidEpubIngestionService;
  return { task, manifest, descriptor, packageCandidate, chapterCandidate, ingestion };
}

describe("planned local chapter inspection execution", () => {
  it("executes only the current plan task and returns digest metadata without prose", async () => {
    const f = fixture();
    const result = await inspectHoidPlannedChapterCandidate(f.task, f.descriptor, f.packageCandidate, f.ingestion);
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.candidate).toMatchObject({
      workId: f.task.workId, chapterNumber: f.task.chapterNumber, locatorId: f.task.locatorId,
      minimumReaderChapter: f.task.chapterNumber + 1, navigationSha256: f.manifest.navigationSha256,
      documentSha256: f.chapterCandidate.documentSha256, authorizationEffect: "none",
      editorialEffect: "none", summaryCreated: false, productionWritePerformed: false,
    });
    expect(result.candidate).not.toHaveProperty("text");
    expect(result.candidate).not.toHaveProperty("bytes");
    expect(result.candidate).not.toHaveProperty("summary");
    expect(f.ingestion.inspectPackage).not.toHaveBeenCalled();
    expect(f.ingestion.inspectChapterDocument).toHaveBeenCalledWith(f.packageCandidate, f.task.navigationHref);
  });

  it("rejects stale or altered plan tasks before touching the local source", async () => {
    const f = fixture();
    const stale = { ...f.task, minimumReaderChapter: f.task.chapterNumber };
    await expect(inspectHoidPlannedChapterCandidate(stale, f.descriptor, f.packageCandidate, f.ingestion))
      .resolves.toEqual({ status: "rejected", reason: "invalid-task" });
    expect(f.ingestion.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rejects a descriptor for another catalogue work", async () => {
    const f = fixture();
    const other = createHoidEpubSourceDescriptor(f.descriptor.sourceId, "twok", "roshar-omnibus-v1");
    await expect(inspectHoidPlannedChapterCandidate(f.task, other, f.packageCandidate, f.ingestion))
      .resolves.toEqual({ status: "rejected", reason: "invalid-source-descriptor" });
    expect(f.ingestion.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rejects a package candidate bound to another local source", async () => {
    const f = fixture();
    const wrongSource = Object.freeze({ ...f.packageCandidate, sourceId: "different-local-source" });
    await expect(inspectHoidPlannedChapterCandidate(f.task, f.descriptor, wrongSource, f.ingestion))
      .resolves.toEqual({ status: "rejected", reason: "source-candidate-mismatch" });
    expect(f.ingestion.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rejects a chapter candidate whose edition navigation digest differs", async () => {
    const f = fixture();
    const bad = Object.freeze({ ...f.chapterCandidate, navigationDocumentSha256: "0".repeat(64) });
    const service = {
      inspectPackage: vi.fn(),
      inspectChapterDocument: vi.fn(async () => ({ status: "candidate" as const, candidate: bad })),
    } as unknown as HoidEpubIngestionService;
    await expect(inspectHoidPlannedChapterCandidate(f.task, f.descriptor, f.packageCandidate, service))
      .resolves.toEqual({ status: "rejected", reason: "chapter-candidate-mismatch" });
  });

  it("propagates a fail-closed source-change rejection", async () => {
    const f = fixture();
    const service = {
      inspectPackage: vi.fn(),
      inspectChapterDocument: vi.fn(async () => ({ status: "rejected" as const, reason: "source-changed" as const })),
    } as unknown as HoidEpubIngestionService;
    await expect(inspectHoidPlannedChapterCandidate(f.task, f.descriptor, f.packageCandidate, service))
      .resolves.toEqual({ status: "rejected", reason: "source-changed" });
  });

  it("rejects accessors without evaluating them", async () => {
    const f = fixture();
    let invoked = false;
    const forged = { ...f.task } as Record<string, unknown>;
    Object.defineProperty(forged, "workId", { enumerable: true, get: () => { invoked = true; return f.task.workId; } });
    await expect(inspectHoidPlannedChapterCandidate(forged, f.descriptor, f.packageCandidate, f.ingestion))
      .resolves.toEqual({ status: "rejected", reason: "invalid-task" });
    expect(invoked).toBe(false);
    expect(f.ingestion.inspectChapterDocument).not.toHaveBeenCalled();
  });
});

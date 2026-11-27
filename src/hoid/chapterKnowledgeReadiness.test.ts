import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentNumbers } from "./verifiedChapterDocuments";
import {
  getHoidChapterKnowledgeReadiness,
} from "./chapterKnowledgeReadiness";

function manifestFor(workId: string) {
  const result = getHoidReadingManifest(workId);
  if (result.status !== "ready") throw new Error(`Missing manifest for ${workId}`);
  return result.manifest;
}

function completedAudit(
  workId: string,
  availableChapterNumbers: readonly number[],
  unavailableChapterNumbers: readonly number[],
) {
  const manifest = manifestFor(workId);
  const total = getVerifiedChapterDocumentNumbers(workId).length;
  return Object.freeze({
    status: "completed" as const,
    workId,
    editionId: manifest.editionId,
    navigationSha256: manifest.navigationSha256,
    manifestId: manifest.manifestId,
    scope: "registered-digest-chapters-only" as const,
    totalAllowlistedChapterCount: total,
    checkedChapterCount: total,
    availableChapterNumbers: Object.freeze([...availableChapterNumbers]),
    unavailableChapterNumbers: Object.freeze([...unavailableChapterNumbers]),
    sourceTextReturned: false as const,
    sourceTextPersisted: false as const,
    providerEgress: "none" as const,
  });
}

describe("Hoid chapter knowledge readiness projection", () => {
  it("reports chapter stages independently without treating cataloguing as source access", () => {
    const result = getHoidChapterKnowledgeReadiness("tfe");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.report).toMatchObject({
      scope: "metadata-only",
      integrity: "consistent",
      workId: "tfe",
      title: "El Imperio Final",
      auditStatus: "not-provided",
      auditScope: null,
      sourceTextIncluded: false,
      providerEgress: "none",
      authorizationEffect: "none",
      progressEffect: "none",
      spoilerUnlockEffect: "none",
    });
    expect(result.report.counts.bodyDigestRegisteredUnitCount).toBe(11);
    expect(result.report.counts.pendingReviewSummaryCount).toBe(10);
    expect(result.report.counts.productionKnowledgeEntryCount).toBe(0);
    expect(result.report.units.every(unit => unit.localSourceStatus === "not-audited")).toBe(true);
    expect(result.report.units.find(unit => unit.chapterNumber === 10)?.editorialStatus).toBe("not-staged");
  });

  it("binds a completed local audit to the exact edition manifest and partitions every registered digest", () => {
    const workId = "tfe";
    const registered = getVerifiedChapterDocumentNumbers(workId);
    const available = registered.slice(0, 5);
    const unavailable = registered.slice(5);
    const audit = completedAudit(workId, available, unavailable);
    const result = getHoidChapterKnowledgeReadiness(workId, audit);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.report.auditStatus).toBe("completed");
    expect(result.report.auditScope).toBe("registered-digest-chapters-only");
    expect(result.report.counts.currentlyAvailableUnitCount).toBe(available.length);
    expect(result.report.counts.currentlyUnavailableUnitCount).toBe(unavailable.length);
    expect(result.report.units.find(unit => unit.chapterNumber === available[0])?.localSourceStatus).toBe("available");
    expect(result.report.units.find(unit => unit.chapterNumber === unavailable[0])?.localSourceStatus).toBe("unavailable");
    expect(result.report.units.find(unit => unit.chapterNumber === 12)?.localSourceStatus).toBe("not-audited");
  });

  it("rejects a stale edition binding and never reuses its availability results", () => {
    const workId = "tfe";
    const registered = getVerifiedChapterDocumentNumbers(workId);
    const audit = {
      ...completedAudit(workId, registered, []),
      editionId: "another-edition",
    };
    const result = getHoidChapterKnowledgeReadiness(workId, audit);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.report.auditStatus).toBe("invalid");
    expect(result.report.counts.currentlyAvailableUnitCount).toBe(0);
    expect(result.report.units.every(unit => unit.localSourceStatus === "not-audited")).toBe(true);
  });

  it("rejects an incomplete or overlapping audit partition", () => {
    const workId = "tfe";
    const registered = getVerifiedChapterDocumentNumbers(workId);
    const audit = completedAudit(workId, registered, [registered[0]]);
    const result = getHoidChapterKnowledgeReadiness(workId, audit);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.report.auditStatus).toBe("invalid");
    expect(result.report.counts.currentlyAvailableUnitCount).toBe(0);
    expect(result.report.counts.currentlyUnavailableUnitCount).toBe(0);
  });

  it("keeps cancelled audits from exposing partial availability", () => {
    const manifest = manifestFor("tfe");
    const audit = {
      status: "cancelled",
      workId: "tfe",
      editionId: manifest.editionId,
      navigationSha256: manifest.navigationSha256,
      manifestId: manifest.manifestId,
      checkedChapterCount: 4,
    };
    const result = getHoidChapterKnowledgeReadiness("tfe", audit);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.report.auditStatus).toBe("cancelled");
    expect(result.report.counts.currentlyAvailableUnitCount).toBe(0);
    expect(result.report.units.every(unit => unit.localSourceStatus === "not-audited")).toBe(true);
  });

  it("preserves duplicate-number chapter units as identity-only rather than collapsing them", () => {
    const result = getHoidChapterKnowledgeReadiness("sawt");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const identityOnly = result.report.units.filter(unit => unit.navigationStatus === "identity-only");
    expect(identityOnly.length).toBeGreaterThan(0);
    expect(new Set(identityOnly.map(unit => unit.unitId)).size).toBe(identityOnly.length);
    expect(identityOnly.some(unit => unit.chapterNumber === 12)).toBe(true);
  });

  it("maps a pending original summary only to its exact chapter, edition, locator and digest", () => {
    const result = getHoidChapterKnowledgeReadiness("twok");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const chapter20 = result.report.units.filter(unit => unit.chapterNumber === 20);
    expect(chapter20).toHaveLength(1);
    expect(chapter20[0]).toMatchObject({
      bodyDigestStatus: "registered",
      pendingReviewSummaryCount: 1,
      productionKnowledgeEntryCount: 0,
      editorialStatus: "pending-review",
    });
    expect(result.report.counts.pendingReviewSummaryCount).toBe(22);
  });

  it("does not expose draft summaries, XHTML, locators, file paths or hashes", () => {
    const result = getHoidChapterKnowledgeReadiness("twok");
    expect(JSON.stringify(result)).not.toContain("summaryKind");
    expect(JSON.stringify(result)).not.toContain("documentSha256");
    expect(JSON.stringify(result)).not.toContain("locatorId");
    expect(JSON.stringify(result)).not.toContain("file://");
    expect(JSON.stringify(result)).not.toContain("xhtml");
  });

  it("fails closed for unknown works and malformed audit objects", () => {
    expect(getHoidChapterKnowledgeReadiness("unknown-work")).toEqual({
      status: "unavailable",
      reason: "unknown-work",
    });

    const malformed = Object.defineProperty({}, "status", {
      enumerable: true,
      get() { throw new Error("must not execute"); },
    });
    const result = getHoidChapterKnowledgeReadiness("tfe", malformed);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.report.auditStatus).toBe("invalid");
    expect(result.report.counts.currentlyAvailableUnitCount).toBe(0);
  });
});

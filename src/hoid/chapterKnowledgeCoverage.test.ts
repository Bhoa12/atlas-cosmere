import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidChapterKnowledgeCoverageReport } from "./chapterKnowledgeCoverage";

describe("Hoid chapter knowledge coverage catalogue", () => {
  it("covers every bibliography work exactly once and preserves catalogue grouping", () => {
    const report = getHoidChapterKnowledgeCoverageReport();
    expect(report.works).toHaveLength(HOID_SOURCE_BIBLIOGRAPHY.length);
    expect(report.catalogue.totalWorks).toBe(HOID_SOURCE_BIBLIOGRAPHY.length);
    expect(report.catalogue.cosmereWorks).toBe(
      HOID_SOURCE_BIBLIOGRAPHY.filter(work => work.sourceGroup === "cosmere.epub").length,
    );
    expect(report.catalogue.rosharWorks).toBe(
      HOID_SOURCE_BIBLIOGRAPHY.filter(work => work.sourceGroup === "roshar-epubs").length,
    );
    expect(new Set(report.works.map(work => work.workId)).size).toBe(report.works.length);
    expect(report.works.map(work => work.workId)).toEqual(
      HOID_SOURCE_BIBLIOGRAPHY.map(work => work.id),
    );
  });

  it("aggregates only works with a verified reading manifest", () => {
    const report = getHoidChapterKnowledgeCoverageReport();
    const ready = report.works.filter(work => work.status === "ready");
    const unavailable = report.works.filter(work => work.status === "unavailable");

    expect(report.coverage.manifestReadyWorkCount).toBe(ready.length);
    expect(report.coverage.manifestUnavailableWorkCount).toBe(unavailable.length);
    expect(report.coverage.totalReadingUnitCount).toBe(
      ready.reduce((sum, work) => sum + (work.counts?.totalReadingUnits ?? 0), 0),
    );
    for (const work of unavailable) {
      expect(work.counts).toBeNull();
      expect(work.integrity).toBe("unavailable");
      expect(["manifest-unavailable", "projection-failed"]).toContain(work.reason);
    }
  });

  it("keeps navigation, body inspection, review and production as separate stages", () => {
    const report = getHoidChapterKnowledgeCoverageReport();
    const ready = report.works.filter(work => work.status === "ready");

    expect(report.coverage.navigationVerifiedUnitCount).toBe(
      ready.reduce((sum, work) => sum + (work.counts?.navigationVerifiedUnitCount ?? 0), 0),
    );
    expect(report.coverage.identityOnlyUnitCount).toBe(
      ready.reduce((sum, work) => sum + (work.counts?.identityOnlyUnitCount ?? 0), 0),
    );
    expect(report.coverage.bodyDigestRegisteredUnitCount).toBe(
      ready.reduce((sum, work) => sum + (work.counts?.bodyDigestRegisteredUnitCount ?? 0), 0),
    );
    expect(report.coverage.pendingReviewSummaryCount).toBe(
      ready.reduce((sum, work) => sum + (work.counts?.pendingReviewSummaryCount ?? 0), 0),
    );
    expect(report.coverage.productionKnowledgeEntryCount).toBe(
      ready.reduce((sum, work) => sum + (work.counts?.productionKnowledgeEntryCount ?? 0), 0),
    );
    expect(report.coverage.approvedClaimReferenceCount).toBe(
      ready.reduce((sum, work) => sum + (work.counts?.approvedClaimReferenceCount ?? 0), 0),
    );
  });

  it("does not claim that private EPUBs are currently available", () => {
    const report = getHoidChapterKnowledgeCoverageReport();
    expect(report.localAvailability).toBe("not-audited");
    expect(report.providerEgress).toBe("none");
    expect(report.sourceTextIncluded).toBe(false);
    expect(report.authorizationEffect).toBe("none");
    expect(report.progressEffect).toBe("none");
    expect(report.spoilerUnlockEffect).toBe("none");
  });

  it("returns deterministic fingerprints and immutable metadata-only records", () => {
    const first = getHoidChapterKnowledgeCoverageReport();
    const second = getHoidChapterKnowledgeCoverageReport();

    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.catalogue.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.catalogue)).toBe(true);
    expect(Object.isFrozen(first.coverage)).toBe(true);
    expect(Object.isFrozen(first.works)).toBe(true);
    expect(first.works.every(work => Object.isFrozen(work))).toBe(true);
    expect(first.works.every(work =>
      work.counts === null || Object.isFrozen(work.counts),
    )).toBe(true);
  });

  it("does not expose source text, locators, digests or reading-progress positions", () => {
    const report = getHoidChapterKnowledgeCoverageReport();
    const forbiddenKeys = new Set([
      "text", "summary", "locatorId", "documentSha256", "navigationSha256",
      "sourcePath", "uri", "cursor", "progressRevision", "positions",
    ]);
    const inspect = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "string") expect(forbiddenKeys.has(key)).toBe(false);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && "value" in descriptor) inspect(descriptor.value);
      }
    };
    inspect(report);
  });
});

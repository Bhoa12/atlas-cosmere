import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
import {
  buildHoidEditorialKnowledgeBundle,
  validateHoidEditorialKnowledgeBundleManifest,
} from "./editorialKnowledgeBundle";

const sourceInput = Object.freeze({
  summaries: HOID_EDITORIAL_DRAFTS,
  claims: HOID_EDITORIAL_CLAIM_DRAFTS,
  entities: HOID_EDITORIAL_ENTITY_DRAFTS,
  relationships: HOID_EDITORIAL_RELATIONSHIP_DRAFTS,
});

describe("Hoid complete editorial knowledge bundle", () => {
  it("creates one deterministic metadata-only manifest for every staging category", () => {
    const first = buildHoidEditorialKnowledgeBundle(sourceInput);
    const second = buildHoidEditorialKnowledgeBundle(sourceInput);

    expect(first.status).toBe("blocked");
    expect(second.status).toBe("blocked");
    if (first.status !== "blocked" || second.status !== "blocked") return;

    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifest.records).toHaveLength(36);
    expect(first.manifest.records.filter(item => item.kind === "summary")).toHaveLength(20);
    expect(first.manifest.records.filter(item => item.kind === "atomic-claim")).toHaveLength(1);
    expect(first.manifest.records.filter(item => item.kind === "entity")).toHaveLength(12);
    expect(first.manifest.records.filter(item => item.kind === "relationship")).toHaveLength(3);
    expect(first.manifest.sources).toHaveLength(20);
    expect(first.manifest.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.promotionAllowed).toBe(false);
    expect(first.productionWritePerformed).toBe(false);
  });

  it("blocks an atomic claim whose subject has no identity dossier", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;

    expect(result.blockers).toContainEqual({
      code: "claim-subject-missing",
      recordId: "tfe.vin.ability.emotional-allomancy",
      relatedId: "tfe.vin",
    });
  });

  it("does not block relationships whose participants have matching identity dossiers", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;

    expect(result.blockers.some(item => item.code.startsWith("relationship-"))).toBe(false);
  });

  it("revalidates the manifest against the exact four source batches", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;

    expect(validateHoidEditorialKnowledgeBundleManifest(result.manifest, sourceInput)).toMatchObject({
      status: "valid",
      bundleStatus: "blocked",
    });
  });

  it("rejects a changed record digest even when the old bundle fingerprint is retained", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;

    const tampered = {
      ...result.manifest,
      records: result.manifest.records.map((record, index) =>
        index === 0 ? { ...record, recordSha256: "a".repeat(64) } : record,
      ),
    };
    expect(validateHoidEditorialKnowledgeBundleManifest(tampered, sourceInput)).toEqual({
      status: "invalid",
      reason: "bundle-fingerprint-mismatch",
    });
  });

  it("rejects a manifest paired with a different source inventory", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;

    const alteredInput = Object.freeze({
      ...sourceInput,
      relationships: Object.freeze([]),
    });
    expect(validateHoidEditorialKnowledgeBundleManifest(result.manifest, alteredInput)).toEqual({
      status: "invalid",
      reason: "bundle-fingerprint-mismatch",
    });
  });

  it("rejects malformed and sparse input arrays before domain validation", () => {
    const sparse = new Array(1);
    expect(buildHoidEditorialKnowledgeBundle({
      ...sourceInput,
      summaries: sparse,
    })).toMatchObject({ status: "invalid", reason: "invalid-input" });

    expect(buildHoidEditorialKnowledgeBundle({
      summaries: [],
      claims: [],
      entities: [],
      relationships: [],
    })).toMatchObject({ status: "invalid", reason: "invalid-input" });
  });

  it("rejects accessor-backed bundle input without invoking the getter", () => {
    let getterCalled = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "summaries", {
      enumerable: true,
      get() {
        getterCalled = true;
        return HOID_EDITORIAL_DRAFTS;
      },
    });
    Object.defineProperties(hostile, {
      claims: { enumerable: true, value: HOID_EDITORIAL_CLAIM_DRAFTS },
      entities: { enumerable: true, value: HOID_EDITORIAL_ENTITY_DRAFTS },
      relationships: { enumerable: true, value: HOID_EDITORIAL_RELATIONSHIP_DRAFTS },
    });

    expect(buildHoidEditorialKnowledgeBundle(hostile)).toMatchObject({
      status: "invalid",
      reason: "invalid-input",
    });
    expect(getterCalled).toBe(false);
  });

  it("keeps narrative prose out of the bundle manifest", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;

    const serialized = JSON.stringify(result.manifest);
    expect(serialized).not.toContain("statement");
    expect(serialized).not.toContain("summarySha256");
    expect(serialized).not.toContain("Shallan llega");
    expect(serialized).not.toContain("Kelsier reconoce");
  });

  it("rejects a manifest with unexpected fields", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;

    expect(validateHoidEditorialKnowledgeBundleManifest({
      ...result.manifest,
      promotionAllowed: true,
    }, sourceInput)).toEqual({
      status: "invalid",
      reason: "invalid-manifest",
    });
  });
});

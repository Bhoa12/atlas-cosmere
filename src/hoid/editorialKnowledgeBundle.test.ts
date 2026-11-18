import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_EDITORIAL_CLAIM_DRAFTS } from "./editorialClaimDrafts";
import { HOID_EDITORIAL_ENTITY_DRAFTS } from "./editorialEntityDrafts";
import { createHoidEditorialRelationshipDraft, HOID_EDITORIAL_RELATIONSHIP_DRAFTS } from "./editorialRelationshipDrafts";
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
    expect(first.status).toBe("ready-for-review");
    expect(second.status).toBe("ready-for-review");
    if (first.status !== "ready-for-review" || second.status !== "ready-for-review") return;
    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifest.records).toHaveLength(47);
    expect(first.manifest.records.filter(item => item.kind === "summary")).toHaveLength(29);
    expect(first.manifest.records.filter(item => item.kind === "atomic-claim")).toHaveLength(1);
    expect(first.manifest.records.filter(item => item.kind === "entity")).toHaveLength(14);
    expect(first.manifest.records.filter(item => item.kind === "relationship")).toHaveLength(3);
    expect(first.manifest.sources).toHaveLength(29);
    expect(first.manifest.blockers).toEqual([]);
    expect(first.manifest.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.promotionAllowed).toBe(false);
    expect(first.productionWritePerformed).toBe(false);
  });

  it("blocks an atomic claim when its source-backed subject dossier is removed", () => {
    const result = buildHoidEditorialKnowledgeBundle({
      ...sourceInput,
      entities: sourceInput.entities.filter(item => item.id !== "tfe.vin"),
    });
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
    expect(result.status).toBe("ready-for-review");
    if (result.status !== "ready-for-review") return;
    expect(result.manifest.blockers).toEqual([]);
  });

  it("uses the exact previously verified TFE identity dossier to close the atomic-claim reference", () => {
    const vinDossier = HOID_EDITORIAL_ENTITY_DRAFTS.find(item => item.id === "tfe.vin");
    expect(vinDossier).toBeDefined();
    if (!vinDossier) return;
    expect(vinDossier.evidence[0].source).toMatchObject({ bookId: "tfe", chapter: 1 });
    const withoutVin = sourceInput.entities.filter(item => item.id !== "tfe.vin");
    const result = buildHoidEditorialKnowledgeBundle({
      ...sourceInput,
      entities: [...withoutVin, vinDossier],
    });
    expect(result.status).toBe("ready-for-review");
    if (result.status !== "ready-for-review") return;
    expect(result.manifest.blockers).toEqual([]);
    expect(result.promotionAllowed).toBe(false);
    expect(result.productionWritePerformed).toBe(false);
  });

  it("blocks a relationship whose participant has no matching entity dossier", () => {
    const original = HOID_EDITORIAL_RELATIONSHIP_DRAFTS[0];
    const altered = createHoidEditorialRelationshipDraft({
      id: original.id,
      predicate: original.predicate,
      subject: { ...original.subject, id: "twok.unknown-character" },
      object: original.object,
      intent: original.intent,
      statement: original.statement,
      evidence: original.evidence,
      relationEvidenceIndices: original.relationEvidenceIndices,
    });
    expect(altered.status).toBe("valid");
    if (altered.status !== "valid") return;
    const result = buildHoidEditorialKnowledgeBundle({
      ...sourceInput,
      relationships: [altered.draft, ...sourceInput.relationships.slice(1)],
    });
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.blockers).toContainEqual({
      code: "relationship-participant-missing",
      recordId: original.id,
      relatedId: "twok.unknown-character",
    });
  });

  it("revalidates the manifest against the exact four source batches", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("ready-for-review");
    if (result.status !== "ready-for-review") return;
    expect(validateHoidEditorialKnowledgeBundleManifest(result.manifest, sourceInput)).toMatchObject({
      status: "valid",
      bundleStatus: "ready-for-review",
    });
  });

  it("rejects a changed record digest even when the old bundle fingerprint is retained", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("ready-for-review");
    if (result.status !== "ready-for-review") return;
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
    expect(result.status).toBe("ready-for-review");
    if (result.status !== "ready-for-review") return;
    const alteredInput = Object.freeze({ ...sourceInput, relationships: Object.freeze([]) });
    expect(validateHoidEditorialKnowledgeBundleManifest(result.manifest, alteredInput)).toEqual({
      status: "invalid",
      reason: "bundle-fingerprint-mismatch",
    });
  });

  it("rejects malformed and sparse input arrays before domain validation", () => {
    const sparse = new Array(1);
    expect(buildHoidEditorialKnowledgeBundle({ ...sourceInput, summaries: sparse }))
      .toMatchObject({ status: "invalid", reason: "invalid-input" });
    expect(buildHoidEditorialKnowledgeBundle({
      summaries: [], claims: [], entities: [], relationships: [],
    })).toMatchObject({ status: "invalid", reason: "invalid-input" });
  });

  it("rejects accessor-backed bundle input without invoking the getter", () => {
    let getterCalled = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "summaries", {
      enumerable: true,
      get() { getterCalled = true; return HOID_EDITORIAL_DRAFTS; },
    });
    Object.defineProperties(hostile, {
      claims: { enumerable: true, value: HOID_EDITORIAL_CLAIM_DRAFTS },
      entities: { enumerable: true, value: HOID_EDITORIAL_ENTITY_DRAFTS },
      relationships: { enumerable: true, value: HOID_EDITORIAL_RELATIONSHIP_DRAFTS },
    });
    expect(buildHoidEditorialKnowledgeBundle(hostile)).toMatchObject({
      status: "invalid", reason: "invalid-input",
    });
    expect(getterCalled).toBe(false);
  });

  it("keeps narrative prose out of the bundle manifest", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("ready-for-review");
    if (result.status !== "ready-for-review") return;
    const serialized = JSON.stringify(result.manifest);
    expect(serialized).not.toContain("statement");
    expect(serialized).not.toContain("summarySha256");
    expect(serialized).not.toContain("Shallan llega");
    expect(serialized).not.toContain("Kelsier reconoce");
  });

  it("rejects a manifest with unexpected fields", () => {
    const result = buildHoidEditorialKnowledgeBundle(sourceInput);
    expect(result.status).toBe("ready-for-review");
    if (result.status !== "ready-for-review") return;
    expect(validateHoidEditorialKnowledgeBundleManifest({
      ...result.manifest, promotionAllowed: true,
    }, sourceInput)).toEqual({ status: "invalid", reason: "invalid-manifest" });
  });
});

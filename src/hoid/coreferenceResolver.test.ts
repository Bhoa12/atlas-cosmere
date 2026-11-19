import { describe, expect, it } from "vitest";
import {
  resolveHoidAuthorizedCoreference,
  resolveProductionHoidCoreference,
  auditHoidCoreferenceRegistry,
  type HoidCoreferenceEntityAuthorizer,
} from "./coreferenceResolver";
import { createHoidConversationContext } from "./conversationContext";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

const NOW = "2026-11-18T12:00:00.000Z";

function progress(
  positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>,
) {
  const canonical = positions.map(position => {
    if (position.completed === true) return { bookId: position.bookId, completed: true as const };
    const cursor = createHoidReadingCursor(position.bookId, position.chapter);
    if (cursor.status !== "ready") throw new Error("Cursor sintético no disponible");
    return { bookId: position.bookId, cursor: cursor.cursor };
  });
  return {
    schemaVersion: 2,
    revision: canonical.length === 0 ? 0 : 1,
    positions: canonical,
    updatedAt: canonical.length === 0 ? null : NOW,
  };
}

function evidence(
  id: string,
  bookId: string,
  sourceChapter: number,
  unlockChapter: number,
) {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === sourceChapter);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  const documentSha256 = getVerifiedChapterDocumentSha256(
    bookId,
    manifest.manifest.editionId,
    manifest.manifest.navigationSha256,
    sourceChapter,
  ) ?? "0".repeat(64);
  return {
    id,
    source: {
      bookId,
      chapter: sourceChapter,
      locatorId: unit.locatorId,
      editionId: manifest.manifest.editionId,
      navigationSha256: manifest.manifest.navigationSha256,
      documentSha256,
    },
    unlock: { bookId, chapter: unlockChapter },
  };
}

function record(
  id: string,
  entityId: string,
  form: "él" | "ella",
  evidenceItems: readonly unknown[] = [evidence("synthetic.coref-evidence." + id, "tfe", 1, 2)],
) {
  return {
    id,
    entityId,
    form,
    evidence: evidenceItems,
    review: {
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "synthetic-coreference-reviewer",
      reviewedAt: NOW,
    },
  };
}

function contextFor(reading: unknown, ids = ["synthetic.entity-a", "synthetic.entity-b"]) {
  const projection = projectHoidCursorProgressSnapshot(reading);
  if (projection.status !== "ready") throw new Error("Progreso sintético no disponible");
  const context = createHoidConversationContext(ids, {
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
  if (!context) throw new Error("Contexto sintético no disponible");
  return context;
}

const authorizeAll: HoidCoreferenceEntityAuthorizer = (reading, ids) => {
  const projection = projectHoidCursorProgressSnapshot(reading);
  if (projection.status !== "ready") return { status: "unavailable", reason: "invalid-progress" };
  return {
    status: "ready",
    resolution: "matched",
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    matches: ids.map(id => ({ id })),
    truncated: false,
  };
};

function resolve(
  question: unknown,
  reading: unknown,
  records: unknown,
  context = contextFor(reading),
  authorize: HoidCoreferenceEntityAuthorizer = authorizeAll,
) {
  return resolveHoidAuthorizedCoreference(question, context, reading, records, authorize);
}

describe("Hoid reviewed, spoiler-scoped coreference", () => {
  it("resolves a feminine singular follow-up only to the unique reviewed entity ID", () => {
    const reading = progress([{ bookId: "tfe", chapter: 3 }]);
    const result = resolve("¿Y ella?", reading, [record("synthetic.coref.ella", "synthetic.entity-b", "ella")]);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.entityId).toBe("synthetic.entity-b");
      expect(result.context.entityIds).toEqual(["synthetic.entity-a", "synthetic.entity-b"]);
      expect(JSON.stringify(result)).not.toContain("synthetic-coreference-reviewer");
      expect(JSON.stringify(result)).not.toContain("ella");
    }
  });

  it("resolves a masculine singular follow-up using an explicit reviewed form, not a name heuristic", () => {
    const reading = progress([{ bookId: "tfe", chapter: 3 }]);
    const result = resolve("¿Y él?", reading, [record("synthetic.coref.el", "synthetic.entity-a", "él")]);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.entityId).toBe("synthetic.entity-a");
  });

  it("recognizes only exact bounded follow-up cues and does not capture a new noun phrase", () => {
    const reading = progress([{ bookId: "tfe", chapter: 3 }]);
    expect(resolve("¿Y ella?", reading, [record("synthetic.coref.ella", "synthetic.entity-b", "ella")]).status)
      .toBe("resolved");
    expect(resolve("¿Y el sistema?", reading, []).status).toBe("not-follow-up");
    expect(resolve("¿Cómo funciona este sistema?", reading, []).status).toBe("not-follow-up");
  });

  it("does not confuse the masculine article `el` with the pronoun `él`", () => {
    const reading = progress([{ bookId: "tfe", chapter: 3 }]);
    const records = [record("synthetic.coref.el", "synthetic.entity-a", "él")];
    expect(resolve("¿Y él?", reading, records).status).toBe("resolved");
    expect(resolve("¿Y el?", reading, records)).toEqual({
      status: "unavailable",
      reason: "ambiguous-reference",
    });
  });

  it("withholds a pronoun when two context entities have the same reviewed form", () => {
    const reading = progress([{ bookId: "tfe", chapter: 3 }]);
    const result = resolve("¿Y ella?", reading, [
      record("synthetic.coref.ella-a", "synthetic.entity-a", "ella"),
      record("synthetic.coref.ella-b", "synthetic.entity-b", "ella"),
    ]);
    expect(result).toEqual({ status: "unavailable", reason: "ambiguous-reference" });
  });

  it("does not infer uniqueness by ignoring a matching but still-locked candidate", () => {
    const reading = progress([
      { bookId: "tfe", chapter: 3 },
      { bookId: "edgedancer", chapter: 3 },
    ]);
    const result = resolve("¿Y ella?", reading, [
      record("synthetic.coref.ella-a", "synthetic.entity-a", "ella"),
      record("synthetic.coref.ella-b", "synthetic.entity-b", "ella", [
        evidence("synthetic.coref-later", "edgedancer", 1, 3),
      ]),
    ]);
    expect(result).toEqual({ status: "unavailable", reason: "reference-unavailable" });
  });

  it("requires every cross-work pronoun evidence threshold (AND semantics)", () => {
    const records = [record("synthetic.coref.cross", "synthetic.entity-b", "ella", [
      evidence("synthetic.coref-cross-a", "tfe", 1, 2),
      evidence("synthetic.coref-cross-b", "edgedancer", 1, 3),
    ])];
    const before = resolve("¿Y ella?", progress([
      { bookId: "tfe", chapter: 3 },
      { bookId: "edgedancer", chapter: 3 },
    ]), records);
    const after = resolve("¿Y ella?", progress([
      { bookId: "tfe", chapter: 3 },
      { bookId: "edgedancer", chapter: 4 },
    ]), records);
    expect(before).toEqual({ status: "unavailable", reason: "reference-unavailable" });
    expect(after.status).toBe("resolved");
  });

  it("revalidates every entity in the prior context before selecting one pronoun target", () => {
    const reading = progress([{ bookId: "tfe", chapter: 2 }]);
    const denied: HoidCoreferenceEntityAuthorizer = () => ({ status: "blocked" });
    const result = resolve(
      "¿Y ella?",
      reading,
      [record("synthetic.coref.ella", "synthetic.entity-b", "ella")],
      contextFor(reading),
      denied,
    );
    expect(result).toEqual({ status: "unavailable", reason: "entity-unavailable" });
  });

  it("rejects a context bound to a different progress fingerprint", () => {
    const oldReading = progress([{ bookId: "tfe", chapter: 2 }]);
    const currentReading = progress([{ bookId: "tfe", chapter: 3 }]);
    const result = resolve(
      "¿Y ella?",
      currentReading,
      [record("synthetic.coref.ella", "synthetic.entity-b", "ella")],
      contextFor(oldReading),
    );
    expect(result).toEqual({ status: "unavailable", reason: "stale-context" });
  });

  it("requires an existing relationship context", () => {
    const reading = progress([{ bookId: "tfe", chapter: 2 }]);
    expect(resolveHoidAuthorizedCoreference(
      "¿Y ella?", null, reading,
      [record("synthetic.coref.ella", "synthetic.entity-b", "ella")],
      authorizeAll,
    )).toEqual({ status: "unavailable", reason: "missing-context" });
  });

  it("rejects evidence from a chapter whose body was not individually inspected", () => {
    const uninspected = evidence("synthetic.coref-uninspected", "tfe", 9, 10);
    const reading = progress([{ bookId: "tfe", chapter: 10 }]);
    const result = resolve("¿Y ella?", reading, [
      record("synthetic.coref.ella", "synthetic.entity-b", "ella", [uninspected]),
    ]);
    expect(result).toEqual({ status: "unavailable", reason: "invalid-registry" });
  });

  it("rejects a coreference record whose stored document digest differs from the inspected EPUB document", () => {
    const reading = progress([{ bookId: "tfe", chapter: 2 }]);
    const item = evidence("synthetic.coref-digest", "tfe", 1, 2);
    const tampered = {
      ...item,
      source: { ...item.source, documentSha256: "f".repeat(64) },
    };
    const result = resolve("¿Y ella?", reading, [
      record("synthetic.coref.ella", "synthetic.entity-b", "ella", [tampered]),
    ]);
    expect(result).toEqual({ status: "unavailable", reason: "invalid-registry" });
  });

  it("rejects a coreference record bound to another edition or navigation digest", () => {
    const reading = progress([{ bookId: "tfe", chapter: 2 }]);
    const item = evidence("synthetic.coref-edition", "tfe", 1, 2);
    const tampered = {
      ...item,
      source: { ...item.source, editionId: "different-edition" },
    };
    const result = resolve("¿Y ella?", reading, [
      record("synthetic.coref.ella", "synthetic.entity-b", "ella", [tampered]),
    ]);
    expect(result).toEqual({ status: "unavailable", reason: "invalid-registry" });
  });

  it("rejects duplicate entity/form mappings instead of selecting the first record", () => {
    const reading = progress([{ bookId: "tfe", chapter: 2 }]);
    const result = resolve("¿Y ella?", reading, [
      record("synthetic.coref.first", "synthetic.entity-b", "ella"),
      record("synthetic.coref.second", "synthetic.entity-b", "ella", [
        evidence("synthetic.coref-second-evidence", "tfe", 1, 2),
      ]),
    ]);
    expect(result).toEqual({ status: "unavailable", reason: "invalid-registry" });
  });

  it("rejects accessor-backed records without invoking their getters", () => {
    const reading = progress([{ bookId: "tfe", chapter: 2 }]);
    const hostile = record("synthetic.coref.ella", "synthetic.entity-b", "ella") as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(hostile, "form", {
      enumerable: true,
      configurable: true,
      get() { invoked = true; return "ella"; },
    });
    const result = resolve("¿Y ella?", reading, [hostile]);
    expect(result).toEqual({ status: "unavailable", reason: "invalid-registry" });
    expect(invoked).toBe(false);
  });

  it("rejects malformed progress and invalid reviewer metadata", () => {
    const reading = { schemaVersion: 1, revision: 0, positions: [], updatedAt: null };
    const valid = progress([{ bookId: "tfe", chapter: 2 }]);
    expect(resolve("¿Y ella?", reading, [], contextFor(valid)).status).toBe("unavailable");
    const invalidReview = {
      ...record("synthetic.coref.bad-review", "synthetic.entity-b", "ella"),
      review: { status: "approved", origin: "provider", reviewerId: "x", reviewedAt: NOW },
    };
    expect(resolve("¿Y ella?", valid, [invalidReview])).toEqual({
      status: "unavailable",
      reason: "invalid-registry",
    });
  });


  it("audits a complete registry into metadata-only deterministic fingerprints", () => {
    const registry = [record("synthetic.coref.audit", "synthetic.entity-b", "ella")];
    const first = auditHoidCoreferenceRegistry(registry);
    const second = auditHoidCoreferenceRegistry(registry);
    expect(first).toEqual(second);
    expect(first.status).toBe("valid");
    if (first.status === "valid") {
      expect(first.recordCount).toBe(1);
      expect(first.recordIds).toEqual(["synthetic.coref.audit"]);
      expect(first.entityIds).toEqual(["synthetic.entity-b"]);
      expect(first.reviewerIds).toEqual(["synthetic-coreference-reviewer"]);
      expect(first.registryFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(first.evidenceFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(JSON.stringify(first)).not.toContain("ella");
    }
  });

  it("audits an empty production registry without manufacturing records", () => {
    expect(auditHoidCoreferenceRegistry([])).toMatchObject({
      status: "valid",
      recordCount: 0,
      recordIds: [],
      entityIds: [],
      reviewerIds: [],
    });
  });

  it("rejects a registry containing an uninspected document", () => {
    const invalid = [record("synthetic.coref.uninspected", "synthetic.entity-b", "ella", [
      evidence("synthetic.coref.uninspected-evidence", "tfe", 9, 10),
    ])];
    expect(auditHoidCoreferenceRegistry(invalid)).toEqual({ status: "invalid" });
  });

  it("keeps the production registry empty and abstains instead of inferring a pronoun target", () => {
    const reading = progress([{ bookId: "tfe", chapter: 2 }]);
    const result = resolveProductionHoidCoreference("¿Y ella?", contextFor(reading), reading);
    expect(result).toEqual({ status: "unavailable", reason: "entity-unavailable" });
  });
});

import { describe, expect, it, vi } from "vitest";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { buildAuthorizedKnowledgeContext } from "./authorizedKnowledgeContext";
import { HoidService } from "./HoidService";
import type { HoidAnswerRequest, HoidProvider, ReadingPosition } from "./types";
import { getHoidReadingManifest } from "./readingManifest";
import { snapshotProviderRequest } from "./providerRequestSnapshot";
import { validReadingPositions } from "./readingValidation";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador de prueba no disponible");
  return unit.locatorId;
}

function entry(): HoidKnowledgeEntry {
  return {
    id: "synthetic-summary-unlock",
    aliases: ["Entidad de prueba"],
    kind: "concept",
    firstSafeAppearance: { bookId: "twok", chapter: 1 },
    evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
    evidenceUnlock: { bookId: "twok", chapter: 4 },
    provenance: "verified",
    summary: "Resumen editorial sintético para probar el límite de divulgación.",
  };
}

describe("catalog entity appearance versus complete-summary unlock", () => {
  it("preserves the exclusive progress union in immutable provider snapshots", () => {
    const partial = snapshotProviderRequest({
      question: "Pregunta sintética.",
      reading: [{ bookId: "twok", chapter: 3 }],
    });
    const completed = snapshotProviderRequest({
      question: "Pregunta sintética.",
      reading: [{ bookId: "twok", completed: true }],
    });

    expect(validReadingPositions(partial.reading)).not.toBeNull();
    expect(partial.reading).toEqual([{ bookId: "twok", chapter: 3 }]);
    expect(validReadingPositions(completed.reading)).not.toBeNull();
    expect(completed.reading).toEqual([{ bookId: "twok", completed: true }]);
    expect(Object.isFrozen(partial.reading)).toBe(true);
    expect(Object.isFrozen(partial.reading[0])).toBe(true);
  });

  it("allows a safe entity mention while withholding its later summary", () => {
    const knowledge = entry();
    const catalog = new HoidKnowledgeCatalog([knowledge]);

    expect(catalog.isEntityMentionUnlocked(knowledge, [{ bookId: "twok", chapter: 1 }])).toBe(true);
    expect(catalog.entriesForContext([{ bookId: "twok", chapter: 1 }])).toHaveLength(0);
    expect(catalog.entriesForContext([{ bookId: "twok", chapter: 3 }])).toHaveLength(0);
    expect(catalog.entriesForContext([{ bookId: "twok", chapter: 4 }])).toHaveLength(1);
  });

  it("requires an explicit edition-bound evidence source and unlock watermark", () => {
    const incomplete: HoidKnowledgeEntry = {
      ...entry(),
      evidenceSource: undefined,
      evidenceUnlock: undefined,
    };
    const catalog = new HoidKnowledgeCatalog([incomplete]);

    expect(catalog.isEntityMentionUnlocked(incomplete, [{ bookId: "twok", chapter: 4 }])).toBe(true);
    expect(catalog.entriesForContext([{ bookId: "twok", chapter: 4 }])).toHaveLength(0);
  });

  it("requires both the first safe appearance and the complete-summary unlock", () => {
    const delayedAppearance: HoidKnowledgeEntry = {
      ...entry(),
      firstSafeAppearance: { bookId: "twok", chapter: 5 },
    };
    const catalog = new HoidKnowledgeCatalog([delayedAppearance]);

    expect(catalog.entriesForContext([{ bookId: "twok", chapter: 4 }])).toHaveLength(0);
    expect(catalog.entriesForContext([{ bookId: "twok", chapter: 5 }])).toHaveLength(1);
  });

  it("does not unlock a summary from progress in a different work", () => {
    const catalog = new HoidKnowledgeCatalog([entry()]);
    expect(catalog.entriesForContext([{ bookId: "wor", chapter: 99 }])).toHaveLength(0);
  });

  it("rejects ambiguous duplicate positions when building provider context", () => {
    const catalog = new HoidKnowledgeCatalog([entry()]);
    expect(catalog.entriesForContext([
      { bookId: "twok", chapter: 4 },
      { bookId: "twok", chapter: 1 },
    ])).toHaveLength(0);
  });

  it("cites the actual summary source chapter rather than first appearance", () => {
    const catalog = new HoidKnowledgeCatalog([entry()]);
    const context = buildAuthorizedKnowledgeContext(catalog, [{ bookId: "twok", chapter: 4 }]);

    expect(context).toHaveLength(1);
    expect(context[0].source).toEqual({ bookId: "twok", chapter: 2 });
    expect(context[0].source.chapter).not.toBe(1);
  });

  it("preserves the canonical phenomenon knowledge kind across the provider context boundary", () => {
    const phenomenon: HoidKnowledgeEntry = {
      ...entry(),
      id: "synthetic-phenomenon-summary",
      kind: "phenomenon",
    };
    const catalog = new HoidKnowledgeCatalog([phenomenon]);
    const reading = [{ bookId: "twok", chapter: 4 }];
    const context = buildAuthorizedKnowledgeContext(catalog, reading);
    const snapshot = snapshotProviderRequest({
      question: "Pregunta sintética.",
      reading,
      knowledgeContext: context,
    }, { includeAuthorizedKnowledgeContext: true });

    expect(context).toHaveLength(1);
    expect(context[0].kind).toBe("phenomenon");
    expect(snapshot.knowledgeContext?.[0].kind).toBe("phenomenon");
  });

  it("accepts a frozen readonly progress snapshot at the catalog boundary", () => {
    const catalog = new HoidKnowledgeCatalog([entry()]);
    const reading: readonly ReadingPosition[] = Object.freeze([
      Object.freeze({ bookId: "twok", chapter: 4 }),
    ]);

    expect(catalog.entriesForContext(reading)).toHaveLength(1);
    expect(buildAuthorizedKnowledgeContext(catalog, reading)).toHaveLength(1);
  });

  it("keeps the legacy provider boundary from receiving a summary before its unlock watermark", async () => {
    let captured: HoidAnswerRequest | undefined;
    const provider: HoidProvider = {
      answer: vi.fn(async (request: HoidAnswerRequest) => {
        captured = request;
        return "Respuesta sintética.";
      }),
    };
    const catalog = new HoidKnowledgeCatalog([entry()]);

    const result = await new HoidService(provider, undefined, catalog).answer({
      question: "Explícame la Entidad de prueba.",
      reading: [{ bookId: "twok", chapter: 1 }],
    });

    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
    expect(captured?.knowledgeContext).toEqual([]);
  });

  it("passes the summary only after its explicit unlock and binds its source citation", async () => {
    let captured: HoidAnswerRequest | undefined;
    const provider: HoidProvider = {
      answer: vi.fn(async (request: HoidAnswerRequest) => {
        captured = request;
        return "Respuesta sintética.";
      }),
    };
    const catalog = new HoidKnowledgeCatalog([entry()]);

    const result = await new HoidService(provider, undefined, catalog).answer({
      question: "Explícame la Entidad de prueba.",
      reading: [{ bookId: "twok", chapter: 4 }],
    });

    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
    expect(captured?.knowledgeContext).toEqual([{
      id: "synthetic-summary-unlock",
      kind: "concept",
      source: { bookId: "twok", chapter: 2 },
      summary: "Resumen editorial sintético para probar el límite de divulgación.",
    }]);
  });
});

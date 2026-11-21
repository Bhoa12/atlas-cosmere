import { describe, expect, it } from "vitest";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { getHoidReadingManifest } from "./readingManifest";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador de prueba no disponible");
  return unit.locatorId;
}

function entry(overrides: Partial<HoidKnowledgeEntry> = {}): HoidKnowledgeEntry {
  return {
    id: "synthetic.catalog.entity",
    aliases: ["Entidad sintética"],
    kind: "concept",
    firstSafeAppearance: { bookId: "tfe", chapter: 5 },
    evidenceSource: {
      bookId: "tfe",
      chapter: 2,
      locatorId: locator("tfe", 2),
    },
    evidenceUnlock: { bookId: "tfe", chapter: 4 },
    summary: "Resumen editorial sintético, creado únicamente para probar el aislamiento del catálogo.",
    provenance: "verified",
    ...overrides,
  };
}

describe("Hoid catalog immutable authorization snapshot", () => {
  it("detaches nested constructor input before retaining the catalog snapshot", () => {
    const input = entry();
    const catalog = new HoidKnowledgeCatalog([input]);

    input.aliases[0] = "Alias manipulado";
    input.firstSafeAppearance.chapter = 1;
    const mutableInputSource = input.evidenceSource as { bookId: string; chapter: number; locatorId: string };
    const mutableInputUnlock = input.evidenceUnlock as { bookId: string; chapter: number };
    mutableInputSource.chapter = 9;
    mutableInputSource.locatorId = "forged-locator";
    mutableInputUnlock.chapter = 9;
    input.summary = "Resumen manipulado.";

    expect(catalog.findMatches("Entidad sintética")).toHaveLength(1);
    expect(catalog.findMatches("Alias manipulado")).toHaveLength(0);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 5 }])).toHaveLength(1);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 2 }])).toHaveLength(0);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 5 }])[0].summary)
      .toBe("Resumen editorial sintético, creado únicamente para probar el aislamiento del catálogo.");
  });

  it("returns detached match copies whose mutation cannot change future authorization", () => {
    const catalog = new HoidKnowledgeCatalog([entry()]);
    const matches = catalog.findMatches("Entidad sintética");
    expect(matches).toHaveLength(1);

    matches[0].aliases[0] = "Alias de salida manipulado";
    expect(matches[0]).not.toHaveProperty("evidenceUnlock");
    expect(matches[0]).not.toHaveProperty("summary");
    expect(matches[0]).not.toHaveProperty("firstSafeAppearance");

    expect(catalog.findMatches("Entidad sintética")).toHaveLength(1);
    expect(catalog.findMatches("Alias de salida manipulado")).toHaveLength(0);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 5 }])[0].summary)
      .toBe("Resumen editorial sintético, creado únicamente para probar el aislamiento del catálogo.");
  });

  it("returns detached context entries whose mutation cannot change the retained summary", () => {
    const catalog = new HoidKnowledgeCatalog([entry()]);
    const contextEntries = catalog.entriesForContext([{ bookId: "tfe", chapter: 5 }]);
    expect(contextEntries).toHaveLength(1);

    contextEntries[0].summary = "Resumen sustituido por el consumidor.";
    (contextEntries[0].evidenceSource as { bookId: string; chapter: number; locatorId: string }).locatorId = "otro-localizador";
    contextEntries[0].aliases.push("Alias añadido externamente");

    const next = catalog.entriesForContext([{ bookId: "tfe", chapter: 5 }]);
    expect(next).toHaveLength(1);
    expect(next[0].summary).toBe(
      "Resumen editorial sintético, creado únicamente para probar el aislamiento del catálogo.",
    );
    expect(next[0].evidenceSource?.locatorId).toBe(locator("tfe", 2));
    expect(next[0].aliases).toEqual(["Entidad sintética"]);
  });

  it("does not authorize a caller-forged first-safe appearance for a known ID", () => {
    const original = entry();
    const catalog = new HoidKnowledgeCatalog([original]);
    const forged = {
      ...original,
      firstSafeAppearance: { bookId: "tfe", chapter: 1 },
    };

    // The caller's forged first-safe chapter is ignored; the catalog's
    // retained chapter-five boundary remains authoritative.
    expect(catalog.isEntityMentionUnlocked(forged, [{ bookId: "tfe", chapter: 1 }])).toBe(false);
    expect(catalog.isEntityMentionUnlocked(forged, [{ bookId: "tfe", chapter: 5 }])).toBe(true);
    expect(catalog.isEntityMentionUnlocked({
      id: "not-in-this-catalog",
    }, [{ bookId: "tfe", chapter: 5 }])).toBe(false);
    expect(catalog.isEntityMentionUnlocked({ id: original.id }, [{ bookId: "tfe", chapter: 5 }])).toBe(true);
  });

  it("rejects accessor-backed catalog entries without executing getters", () => {
    let invoked = false;
    const hostile = {
      aliases: ["Entidad hostil"],
      kind: "concept",
      firstSafeAppearance: { bookId: "tfe", chapter: 1 },
    } as Record<string, unknown>;
    Object.defineProperty(hostile, "id", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "hostile.catalog.entry";
      },
    });

    const catalog = new HoidKnowledgeCatalog([hostile as unknown as HoidKnowledgeEntry]);
    expect(invoked).toBe(false);
    expect(catalog.findMatches("Entidad hostil")).toHaveLength(0);
  });

  it("rejects malformed, unverified or out-of-manifest first appearances", () => {
    const catalog = new HoidKnowledgeCatalog([
      entry({ id: "invalid.unknown.work", firstSafeAppearance: { bookId: "unknown", chapter: 1 } }),
      entry({ id: "invalid.zero.chapter", firstSafeAppearance: { bookId: "tfe", chapter: 0 } }),
      entry({ id: "invalid.outside.manifest", firstSafeAppearance: { bookId: "tfe", chapter: 999_999 } }),
    ]);

    expect(catalog.findMatches("Entidad sintética")).toHaveLength(0);
  });

  it("rejects all entries sharing a normalized duplicate identity", () => {
    const first = entry({ id: "Duplicate.Entity", aliases: ["Primera entidad"] });
    const second = entry({ id: "duplicate.entity", aliases: ["Segunda entidad"] });
    const catalog = new HoidKnowledgeCatalog([first, second]);

    expect(catalog.findMatches("Primera entidad")).toHaveLength(0);
    expect(catalog.findMatches("Segunda entidad")).toHaveLength(0);
  });

  it("rejects duplicate aliases after Unicode canonicalization", () => {
    const catalog = new HoidKnowledgeCatalog([
      entry({ aliases: ["Álvaro", "A\u0301lvaro"] }),
    ]);

    expect(catalog.findMatches("Álvaro")).toHaveLength(0);
  });

  it("drops an invalid evidence tuple without granting provider-facing summary access", () => {
    const invalidEvidence = entry({
      evidenceSource: {
        bookId: "tfe",
        chapter: 2,
        locatorId: "not-the-manifest-locator",
      },
    });
    const catalog = new HoidKnowledgeCatalog([invalidEvidence]);

    expect(catalog.findMatches("Entidad sintética")).toHaveLength(1);
    expect(catalog.isEntityMentionUnlocked(invalidEvidence, [{ bookId: "tfe", chapter: 5 }])).toBe(true);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 10 }])).toHaveLength(0);
  });

  it("rejects oversized and sparse catalog arrays instead of partially trusting them", () => {
    const sparse = new Array(2) as HoidKnowledgeEntry[];
    sparse[1] = entry();
    expect(new HoidKnowledgeCatalog(sparse).findMatches("Entidad sintética")).toHaveLength(0);

    const oversized = Array.from({ length: 513 }, (_, index) =>
      entry({ id: "synthetic.entry." + index }),
    );
    expect(new HoidKnowledgeCatalog(oversized).findMatches("Entidad sintética")).toHaveLength(0);
  });
});

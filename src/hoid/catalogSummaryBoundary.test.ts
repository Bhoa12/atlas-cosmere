import { describe, expect, it } from "vitest";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { validatedKnowledge } from "./catalogValidation";
import { getHoidReadingManifest } from "./readingManifest";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Verified manifest unavailable");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Verified locator unavailable");
  return unit.locatorId;
}

function entry(overrides: Partial<HoidKnowledgeEntry> = {}): HoidKnowledgeEntry {
  return {
    id: "synthetic.summary.boundary",
    aliases: ["Entidad sintética"],
    kind: "concept",
    firstSafeAppearance: { bookId: "tfe", chapter: 1 },
    evidenceSource: { bookId: "tfe", chapter: 2, locatorId: locator("tfe", 2) },
    evidenceUnlock: { bookId: "tfe", chapter: 4 },
    summary: "Resumen editorial sintético para probar la frontera de evidencia.",
    provenance: "verified",
    ...overrides,
  };
}

describe("Hoid canonical summary disclosure boundary", () => {
  it("retains a summary only with a complete verified evidence tuple", () => {
    expect(validatedKnowledge([entry()])[0]).toMatchObject({
      summary: "Resumen editorial sintético para probar la frontera de evidencia.",
      provenance: "verified",
      evidenceSource: { bookId: "tfe", chapter: 2, locatorId: locator("tfe", 2) },
      evidenceUnlock: { bookId: "tfe", chapter: 4 },
    });
  });

  it("strips summary and provenance when the source locator is invalid", () => {
    const malformed = entry({
      evidenceSource: { bookId: "tfe", chapter: 2, locatorId: "forged-locator" },
    });
    const [canonical] = validatedKnowledge([malformed]);

    expect(canonical).toBeDefined();
    expect(canonical.evidenceSource).toBeUndefined();
    expect(canonical.evidenceUnlock).toBeUndefined();
    expect(canonical.summary).toBeUndefined();
    expect(canonical.provenance).toBeUndefined();
    const match = new HoidKnowledgeCatalog([malformed]).findMatches("Entidad sintética");
    expect(match).toHaveLength(1);
    expect(match[0]).not.toHaveProperty("summary");
    expect(match[0]).not.toHaveProperty("provenance");
    expect(match[0]).not.toHaveProperty("evidenceSource");
    expect(match[0]).not.toHaveProperty("evidenceUnlock");
  });

  it("strips summary and provenance when the unlock watermark is missing", () => {
    const incomplete = entry({ evidenceUnlock: undefined });
    const [canonical] = validatedKnowledge([incomplete]);

    expect(canonical.evidenceSource).toBeDefined();
    expect(canonical.evidenceUnlock).toBeUndefined();
    expect(canonical.summary).toBeUndefined();
    expect(canonical.provenance).toBeUndefined();
  });

  it("strips summary and provenance when the unlock precedes its source", () => {
    const inconsistent = entry({
      evidenceUnlock: { bookId: "tfe", chapter: 1 },
    });
    const [canonical] = validatedKnowledge([inconsistent]);

    expect(canonical.evidenceSource).toBeDefined();
    expect(canonical.evidenceUnlock).toBeUndefined();
    expect(canonical.summary).toBeUndefined();
    expect(canonical.provenance).toBeUndefined();
  });

  it("does not retain provider-facing summary text for limited provenance", () => {
    const limited = entry({ provenance: "limited" });
    const [canonical] = validatedKnowledge([limited]);

    expect(canonical.evidenceSource).toBeDefined();
    expect(canonical.evidenceUnlock).toBeDefined();
    expect(canonical.provenance).toBe("limited");
    expect(canonical.summary).toBeUndefined();
    expect(new HoidKnowledgeCatalog([limited]).entriesForContext([
      { bookId: "tfe", chapter: 4 },
    ])).toEqual([]);
  });

  it("does not expose a summary when provenance is absent or unrecognized", () => {
    const absent = entry({ provenance: undefined });
    const unrecognized = {
      ...entry(),
      provenance: "verified-by-provider",
    } as unknown as HoidKnowledgeEntry;

    for (const candidate of [absent, unrecognized]) {
      const [canonical] = validatedKnowledge([candidate]);
      expect(canonical.summary).toBeUndefined();
      expect(canonical.provenance).toBeUndefined();
    }
  });

  it("never returns narrative summaries or evidence through name matching before the unlock", () => {
    const trusted = entry();
    const catalog = new HoidKnowledgeCatalog([trusted]);
    const [match] = catalog.findMatches("Entidad sintética");

    expect(match).toMatchObject({
      id: trusted.id,
      aliases: trusted.aliases,
      kind: trusted.kind,
      firstSafeAppearance: trusted.firstSafeAppearance,
    });
    expect(match).not.toHaveProperty("summary");
    expect(match).not.toHaveProperty("provenance");
    expect(match).not.toHaveProperty("evidenceSource");
    expect(match).not.toHaveProperty("evidenceUnlock");
    expect(catalog.isEntityMentionUnlocked(match, [{ bookId: "tfe", chapter: 1 }])).toBe(true);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 1 }])).toEqual([]);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 4 }])).toHaveLength(1);
  });

  it("does not return unmentioned aliases that may be spoiler-bearing", () => {
    const catalog = new HoidKnowledgeCatalog([entry({
      aliases: ["Alias ya mencionado", "Alias todavía desconocido"],
    })]);
    const [match] = catalog.findMatches("Alias ya mencionado");

    expect(match.aliases).toEqual(["Alias ya mencionado"]);
    expect(match.aliases).not.toContain("Alias todavía desconocido");
    expect(match).not.toHaveProperty("summary");
    expect(match).not.toHaveProperty("evidenceSource");
  });

  it("keeps name-only metadata mentionable without making its summary available", () => {
    const malformed = entry({
      evidenceSource: undefined,
      evidenceUnlock: undefined,
    });
    const catalog = new HoidKnowledgeCatalog([malformed]);
    const [canonical] = validatedKnowledge([malformed]);

    expect(canonical.aliases).toEqual(["Entidad sintética"]);
    expect(canonical.summary).toBeUndefined();
    expect(catalog.isEntityMentionUnlocked(canonical, [{ bookId: "tfe", chapter: 1 }])).toBe(true);
    expect(catalog.entriesForContext([{ bookId: "tfe", chapter: 4 }])).toEqual([]);
  });
});

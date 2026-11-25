import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  getHoidSourceCatalogManifest,
  HOID_SOURCE_CATALOG_MANIFEST,
} from "./sourceCatalogManifest";

const EXPECTED_WORKS = [
  ["tfe", "El Imperio Final", "cosmere.epub"],
  ["woa", "El Pozo de la Ascensión", "cosmere.epub"],
  ["hoa", "El Héroe de las Eras", "cosmere.epub"],
  ["aol", "Aleación de ley", "cosmere.epub"],
  ["sos", "Sombras de identidad", "cosmere.epub"],
  ["bom", "Brazales de Duelo", "cosmere.epub"],
  ["tlm", "El metal perdido", "cosmere.epub"],
  ["warbreaker", "El aliento de los dioses", "cosmere.epub"],
  ["elantris", "Elantris", "cosmere.epub"],
  ["white-sand-1", "Arena blanca vol. 1", "cosmere.epub"],
  ["white-sand-2", "Arena blanca vol. 2", "cosmere.epub"],
  ["white-sand-3", "Arena blanca vol. 3", "cosmere.epub"],
  ["tress", "Trenza del mar Esmeralda", "cosmere.epub"],
  ["yumi", "Yumi y el pintor de pesadillas", "cosmere.epub"],
  ["sunlit", "El Hombre Iluminado", "cosmere.epub"],
  ["isles", "Islas de la ascuaoscura", "cosmere.epub"],
  ["arcanum", "Arcanum ilimitado", "cosmere.epub"],
  ["twok", "El Camino de los Reyes", "roshar-epubs"],
  ["wor", "Palabras radiantes", "roshar-epubs"],
  ["ob", "Juramentada", "roshar-epubs"],
  ["row", "El Ritmo de la Guerra", "roshar-epubs"],
  ["sawt", "Viento y Verdad", "roshar-epubs"],
  ["edgedancer", "Danzante del Filo", "roshar-epubs"],
  ["dawnshard", "Esquirla del amanecer", "roshar-epubs"],
] as const;

describe("Hoid metadata-only source catalogue manifest", () => {
  it("matches the complete user-supplied 24-work inventory exactly", () => {
    const actual = HOID_SOURCE_CATALOG_MANIFEST.works.map(source => [
      source.id,
      source.title,
      source.sourceGroup,
    ]);
    expect(actual).toEqual(EXPECTED_WORKS);
    expect(HOID_SOURCE_BIBLIOGRAPHY).toHaveLength(24);
  });

  it("separates the 17 Cosmere catalogue entries from the seven Roshar EPUB entries", () => {
    expect(HOID_SOURCE_CATALOG_MANIFEST.workCount).toBe(24);
    expect(HOID_SOURCE_CATALOG_MANIFEST.groups).toEqual({
      cosmereEpub: 17,
      rosharEpubs: 7,
    });
  });

  it("pins a deterministic fingerprint over ordered identity metadata only", () => {
    expect(HOID_SOURCE_CATALOG_MANIFEST.fingerprint).toBe(
      "4cc935583679307826664e2555f2df6ae55d8784b758c6aaf35afbc05e43b01b",
    );
    expect(HOID_SOURCE_CATALOG_MANIFEST.scope).toBe("metadata-only");
    expect(HOID_SOURCE_CATALOG_MANIFEST.sourceContentIncluded).toBe(false);
  });

  it("does not claim that private source bytes are currently accessible", () => {
    expect(HOID_SOURCE_CATALOG_MANIFEST.accessStatus).toBe("not-asserted");
  });

  it("returns a deeply immutable snapshot without narrative content or source locators", () => {
    const manifest = getHoidSourceCatalogManifest();
    expect(manifest).toBe(HOID_SOURCE_CATALOG_MANIFEST);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.groups)).toBe(true);
    expect(Object.isFrozen(manifest.works)).toBe(true);
    expect(manifest.works.every(Object.isFrozen)).toBe(true);
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("summary");
    expect(serialized).not.toContain("locatorId");
    expect(serialized).not.toContain("documentSha256");
    expect(serialized).not.toContain("EPUB/");
  });
});

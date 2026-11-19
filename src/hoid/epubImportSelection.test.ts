import { describe, expect, it } from "vitest";
import {
  createHoidEpubSourceDescriptor,
  getHoidEpubImportChoices,
} from "./epubImportSelection";

describe("explicit EPUB work and edition selection", () => {
  it("exposes the complete 24-work bibliography in canonical order", () => {
    const choices = getHoidEpubImportChoices();
    expect(choices).toHaveLength(24);
    expect(choices[0]).toMatchObject({ workId: "tfe", title: "El Imperio Final" });
    expect(choices[23]).toMatchObject({ workId: "dawnshard", title: "Esquirla del amanecer" });
  });

  it("keeps the two private source groups distinct", () => {
    const choices = getHoidEpubImportChoices();
    expect(choices.filter(item => item.sourceGroup === "cosmere.epub")).toHaveLength(17);
    expect(choices.filter(item => item.sourceGroup === "roshar-epubs")).toHaveLength(7);
  });

  it("requires every currently catalogued work to have a registered edition policy", () => {
    expect(getHoidEpubImportChoices().every(item => item.supported && item.editionId !== null)).toBe(true);
  });

  it("binds a selected work to its exact registered edition and source group", () => {
    expect(createHoidEpubSourceDescriptor(
      "local-source-1",
      "tfe",
      "cosmere-epub-merged-v1",
    )).toEqual({
      sourceId: "local-source-1",
      workId: "tfe",
      editionId: "cosmere-epub-merged-v1",
      sourceGroup: "cosmere.epub",
    });
  });

  it("rejects an edition that does not match the selected work", () => {
    expect(createHoidEpubSourceDescriptor(
      "local-source-1",
      "tfe",
      "roshar-omnibus-v1",
    )).toBeNull();
  });

  it("rejects unknown works and malformed source identifiers", () => {
    expect(createHoidEpubSourceDescriptor("local-source-1", "unknown-work", "any-edition")).toBeNull();
    expect(createHoidEpubSourceDescriptor("content://private/book.epub", "tfe", "cosmere-epub-merged-v1")).toBeNull();
    expect(createHoidEpubSourceDescriptor("", "tfe", "cosmere-epub-merged-v1")).toBeNull();
  });

  it("keeps White Sand volumes unsegmented while preserving their shared edition binding", () => {
    const choices = getHoidEpubImportChoices().filter(item => item.workId.startsWith("white-sand-"));
    expect(choices).toHaveLength(3);
    expect(choices.every(item => item.progressMode === "requires-volume-segmentation")).toBe(true);
    expect(new Set(choices.map(item => item.editionId))).toEqual(new Set(["cosmere-epub-merged-v1"]));
  });

  it("keeps Arcanum as a section collection rather than inventing a global chapter count", () => {
    const arcanum = getHoidEpubImportChoices().find(item => item.workId === "arcanum");
    expect(arcanum).toMatchObject({
      progressMode: "collection-sections",
      editionId: "cosmere-epub-merged-v1",
      supported: true,
    });
  });
});

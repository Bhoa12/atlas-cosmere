import { retrieveAuthorized } from "./retrieval";
import { KnowledgeItem } from "./types";

const item: KnowledgeItem = { id: "x", sourceId: "elantris", unlockChapter: 3, summary: "Resumen original", tags: ["tema"] };

describe("retrieveAuthorized", () => {
  it("does not unlock another book's knowledge", () => {
    expect(retrieveAuthorized([item], [{ sourceId: "warbreaker", chapter: 99 }], "tema")).toEqual([]);
  });
  it("blocks future chapters", () => {
    expect(retrieveAuthorized([item], [{ sourceId: "elantris", chapter: 2 }], "tema")).toEqual([]);
  });
  it("allows the exact unlock chapter", () => {
    expect(retrieveAuthorized([item], [{ sourceId: "elantris", chapter: 3 }], "tema")).toEqual([item]);
  });
});

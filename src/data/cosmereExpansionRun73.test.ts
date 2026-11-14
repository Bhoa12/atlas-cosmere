import { describe, expect, it } from "vitest";
import type { Catalog } from "./cosmereExpansionRun72";
import { evaluateContentVisibility, validateContentRecord, type ContentRecord } from "./cosmereExpansionRun73";

const catalog: Catalog = {
  sources: [
    { id: "index", kind: "verified-index" },
    { id: "accessible-note", kind: "accessible" },
  ],
  worlds: [
    { id: "scadrial", name: "Scadrial" },
    { id: "sel", name: "Sel" },
    { id: "nalthis", name: "Nalthis" },
    { id: "taldain", name: "Taldain" },
    { id: "roshar", name: "Roshar" },
  ],
  works: [{ id: "synthetic-work", title: "Synthetic", sourceId: "index" }],
  units: [
    { id: "start", workId: "synthetic-work", position: 1 },
    { id: "finish", workId: "synthetic-work", position: 2 },
  ],
};

describe("cosmere expansion run 73", () => {
  it("rejects editorial summaries backed only by an index", () => {
    const content: ContentRecord = {
      id: "c1", workId: "synthetic-work", sourceId: "index",
      sourceKind: "metadata-only", summary: "Invented summary", requiredUnitIds: ["start"],
    };
    expect(validateContentRecord(catalog, content)).toContain("content:summary-without-accessible-source:c1");
  });

  it("keeps accessible summaries behind explicit reading requirements", () => {
    const content: ContentRecord = {
      id: "c2", workId: "synthetic-work", sourceId: "accessible-note",
      sourceKind: "accessible", summary: "Original synthetic summary", requiredUnitIds: ["start", "finish"],
    };
    expect(evaluateContentVisibility(catalog, content, [
      { workId: "synthetic-work", completedUnitIds: ["start"] },
    ])).toMatchObject({ visible: false, reason: "incomplete", pendingUnitIds: ["finish"] });
    expect(evaluateContentVisibility(catalog, content, [
      { workId: "synthetic-work", completedUnitIds: ["start", "finish"] },
    ])).toMatchObject({ visible: true, reason: "ready" });
  });

  it("does not treat a declared private or index source as accessible", () => {
    const content: ContentRecord = {
      id: "c3", workId: "synthetic-work", sourceId: "index",
      sourceKind: "accessible", requiredUnitIds: ["start"],
    };
    expect(validateContentRecord(catalog, content)).toContain("content:declared-accessible-but-source-is-not:c3");
  });
});

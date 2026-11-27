import { describe, expect, it } from "vitest";
import {
  createProductionHoidInvestigationContextConversationAdapter,
  isHoidInvestigationContextConversationAdapter,
} from "./investigationContextConversation";
import { createHoidReadingCursor } from "./readingManifest";

const NOW = "2026-11-27T12:00:00.000Z";
const SCOPE = Object.freeze({
  mode: "single-work" as const,
  bookIds: Object.freeze(["tfe"]),
});

function progress(chapter = 1) {
  const cursor = createHoidReadingCursor("tfe", chapter);
  if (cursor.status !== "ready") throw new Error("Synthetic progress cursor unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision: chapter,
    positions: Object.freeze([
      Object.freeze({ bookId: "tfe", cursor: cursor.cursor }),
    ]),
    updatedAt: NOW,
  });
}

describe("Hoid production investigation-context conversation boundary", () => {
  it("creates a locally branded adapter", () => {
    const snapshot = progress();
    const adapter = createProductionHoidInvestigationContextConversationAdapter(() => snapshot);
    expect(isHoidInvestigationContextConversationAdapter(adapter)).toBe(true);
    expect(isHoidInvestigationContextConversationAdapter(
      JSON.parse(JSON.stringify(adapter)),
    )).toBe(false);
  });

  it("returns an empty, progress-bound presentation while production editorial registries are empty", () => {
    const snapshot = progress();
    const adapter = createProductionHoidInvestigationContextConversationAdapter(() => snapshot);
    const result = adapter!.present({
      progress: snapshot,
      history: [],
      bookScope: SCOPE,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.links).toEqual([]);
    expect(result.progressRevision).toBe(1);
  });

  it("rejects malformed requests instead of accepting caller-supplied graph or labels", () => {
    const snapshot = progress();
    const adapter = createProductionHoidInvestigationContextConversationAdapter(() => snapshot);
    expect(adapter!.present({
      progress: snapshot,
      history: [],
      bookScope: SCOPE,
      graph: { status: "ready", nodes: [], edges: [] },
      labels: ["spoofed"],
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
  });

  it("fails closed when the supplied progress cannot build an authorized graph", () => {
    const adapter = createProductionHoidInvestigationContextConversationAdapter(() => progress());
    expect(adapter!.present({
      progress: { schemaVersion: 2, revision: -1, positions: [] },
      history: [],
      bookScope: SCOPE,
    })).toEqual({ status: "unavailable", reason: "invalid-graph" });
  });

  it("withholds a graph built against progress that no longer matches the live cursor", () => {
    const original = progress(1);
    const changed = progress(2);
    const adapter = createProductionHoidInvestigationContextConversationAdapter(() => changed);
    const result = adapter!.present({
      progress: original,
      history: [],
      bookScope: SCOPE,
    });
    expect(result.status).toBe("unavailable");
  });
});

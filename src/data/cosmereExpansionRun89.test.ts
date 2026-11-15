import { sourceCanBackDescriptor, validateDescriptors, visibleDescriptors } from "./cosmereExpansionRun89";

describe("cosmere expansion run 89", () => {
  const sources = [
    { id: "index", kind: "verified-index" as const, accessible: false },
    { id: "private", kind: "declared-private" as const, accessible: false },
    { id: "editorial", kind: "editorial-accessible" as const, accessible: true },
  ];
  const works = [{ id: "work", title: "Synthetic", sourceId: "index" }];
  const units = [{ id: "u1", workId: "work", position: 1, sourceId: "editorial" }];
  const gates = [{ id: "g1", workId: "work", requiredUnitIds: ["u1"] }];

  it("allows index-backed metadata but not summaries", () => {
    expect(sourceCanBackDescriptor(sources[0], "metadata")).toBe(true);
    expect(sourceCanBackDescriptor(sources[0], "original-summary")).toBe(false);
    expect(sourceCanBackDescriptor(sources[2], "original-summary")).toBe(true);
  });

  it("rejects a descriptor backed only by an inaccessible private source", () => {
    expect(validateDescriptors(
      [{ id: "d", workId: "work", kind: "original-summary", sourceId: "private" }],
      works, sources, units, gates,
    ).valid).toBe(false);
  });

  it("keeps gated content hidden until valid requirements are complete", () => {
    const descriptors = [{ id: "d", workId: "work", kind: "metadata" as const, sourceId: "index", spoilerGateId: "g1" }];
    expect(visibleDescriptors(descriptors, [], gates, units)).toHaveLength(0);
    expect(visibleDescriptors(descriptors, ["u1"], gates, units)).toHaveLength(1);
  });
});

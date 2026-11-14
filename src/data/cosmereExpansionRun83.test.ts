import { strict as assert } from "node:assert";
import test from "node:test";
import {
  evaluateSpoilerGate,
  reconcileProgress,
  sourceCanBackOriginalSummary,
  verifiedCatalogTitles,
  type ReadingUnit,
} from "./cosmereExpansionRun83";

test("catalog preserves the verified title list as metadata", () => {
  assert.equal(verifiedCatalogTitles.length, 17);
});

test("uninspected sources cannot back editorial summaries", () => {
  assert.equal(
    sourceCanBackOriginalSummary({ id: "private", kind: "declared-private", accessible: false }),
    false,
  );
  assert.equal(
    sourceCanBackOriginalSummary({ id: "index", kind: "verified-index", accessible: true }),
    false,
  );
});

test("progress ignores foreign and unknown units and preserves reading order", () => {
  const units: ReadingUnit[] = [
    { id: "two", workId: "work", position: 2, sourceId: "source" },
    { id: "one", workId: "work", position: 1, sourceId: "source" },
  ];
  assert.deepEqual(
    reconcileProgress("work", units, [
      { workId: "other", completedUnitIds: ["one"] },
      { workId: "work", completedUnitIds: ["unknown", "two", "one", "one"] },
    ]),
    ["one", "two"],
  );
});

test("spoiler gates fail closed until every explicit requirement is complete", () => {
  const units: ReadingUnit[] = [
    { id: "one", workId: "work", position: 1, sourceId: "source" },
    { id: "two", workId: "work", position: 2, sourceId: "source" },
  ];
  const gate = { workId: "work", requiredUnitIds: ["one", "two"] };
  assert.equal(evaluateSpoilerGate(gate, units, ["one"]).visible, false);
  assert.equal(evaluateSpoilerGate(gate, units, ["one", "two"]).visible, true);
});

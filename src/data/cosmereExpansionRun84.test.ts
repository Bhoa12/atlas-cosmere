import { catalogTitles, evaluateSpoilerGate, reconcileProgress, sourceCanBackReadingUnit, validateReadingUnits } from "./cosmereExpansionRun84";

const sources = [
  { id: "index", kind: "verified-index" as const, accessible: false },
  { id: "editorial", kind: "editorial-accessible" as const, accessible: true }
];
const works = [{ id: "work", title: "Synthetic", sourceId: "index" }];
const units = [
  { id: "u1", workId: "work", position: 1, sourceId: "editorial" },
  { id: "u2", workId: "work", position: 2, sourceId: "editorial" }
];

if (catalogTitles.length !== 17) throw new Error("catalog mismatch");
if (sourceCanBackReadingUnit(sources[0])) throw new Error("index must not back reading structure");
if (validateReadingUnits(units, sources, works).length) throw new Error("valid units rejected");
if (reconcileProgress("work", units, [{ workId: "other", completedUnitIds: ["u1"] }, { workId: "work", completedUnitIds: ["u2", "unknown", "u1"] }]).join(",") !== "u1,u2") throw new Error("progress reconciliation failed");
if (evaluateSpoilerGate(["u1", "u2"], ["u1"], units).unlocked) throw new Error("spoiler gate opened early");
if (!evaluateSpoilerGate(["u1", "u2"], ["u1", "u2"], units).unlocked) throw new Error("spoiler gate stayed closed");

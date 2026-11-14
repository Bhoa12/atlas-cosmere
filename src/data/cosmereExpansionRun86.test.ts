import {
  planSpoilerVisibility,
  priorityWorlds,
  validateWorldLinks,
  validatedReadingUnits,
} from "./cosmereExpansionRun86";

const sources = [
  { id: "catalog", kind: "catalog-index" as const, accessible: true },
  { id: "private", kind: "private-declared" as const, accessible: false },
  { id: "editorial", kind: "editorial-accessible" as const, accessible: true },
];
const works = [{ id: "work-a", title: "Synthetic work", sourceId: "catalog" }];
const links = validateWorldLinks(priorityWorlds, works, [
  { worldId: "scadrial", workId: "work-a", sourceId: "catalog" },
  { worldId: "unknown", workId: "work-a", sourceId: "catalog" },
], sources);
if (links.valid.length !== 1 || links.invalid.length !== 1) throw new Error("link validation failed");

const units = validatedReadingUnits("work-a", [
  { id: "u1", workId: "work-a", position: 2, sourceId: "editorial" },
  { id: "u2", workId: "work-a", position: 1, sourceId: "editorial" },
  { id: "private-unit", workId: "work-a", position: 3, sourceId: "private" },
  { id: "duplicate-position", workId: "work-a", position: 1, sourceId: "editorial" },
], sources);
if (units.map(unit => unit.id).join(",") !== "u2,u1") throw new Error("reading validation failed");

const partial = planSpoilerVisibility(["u2", "u1"], units, [
  { workId: "work-a", completedUnitIds: ["u2"] },
  { workId: "other-work", completedUnitIds: ["u1"] },
]);
if (partial.unlocked || partial.pending.join(",") !== "u1") throw new Error("cross-work progress leaked");

const complete = planSpoilerVisibility(["u2", "u1"], units, [
  { workId: "work-a", completedUnitIds: ["u2", "u1"] },
]);
if (!complete.unlocked) throw new Error("complete progress did not unlock");

const malformed = planSpoilerVisibility(["u1", "u1"], units, []);
if (malformed.unlocked) throw new Error("duplicate requirements must fail closed");

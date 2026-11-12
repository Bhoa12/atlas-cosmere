import { resolveVisibility, validateCatalogue } from "./cosmereExpansion";

const errors = validateCatalogue(
  [{ id: "catalogue-index", status: "verified-index" }],
  [{ id: "scadrial", name: "Scadrial" }],
  [{ id: "sample-work", title: "Sample", sourceId: "catalogue-index", worldId: "scadrial" }],
  [{ id: "unit-1", workId: "sample-work", order: 1 }],
);
if (errors.length) throw new Error("expected valid synthetic catalogue");

if (resolveVisibility(["unit-1"], { workId: "sample-work", completedUnitIds: ["unit-1"] }) !== "visible") throw new Error("expected visible");
if (resolveVisibility(["unit-1"], { workId: "sample-work", completedUnitIds: [] }) !== "locked") throw new Error("expected locked");
if (resolveVisibility(["unit-1", "unit-1"], { workId: "sample-work", completedUnitIds: ["unit-1"] }) !== "locked") throw new Error("expected fail-closed duplicate requirement");

import { catalogContainsBook, validateCatalog } from "./catalogContract";

const result = validateCatalog([
  { sourceId: "cosmere-epub", title: "Cosmere", bookIds: ["mistborn-1", "elantris"], access: "private" },
  { sourceId: "cosmere-epub", title: "Duplicate", bookIds: ["mistborn-2"], access: "private" },
  { sourceId: "", title: "Broken", bookIds: ["x"], access: "private" },
]);

if (result.accepted.length !== 1 || result.rejected.length !== 2) throw new Error("Catalog validation must fail closed.");
if (!catalogContainsBook(result.accepted, "elantris")) throw new Error("Expected known catalog metadata.");
if (catalogContainsBook(result.accepted, "unknown-book")) throw new Error("Unknown books must not be inferred.");
if (Object.prototype.hasOwnProperty.call(result.accepted[0], "text")) throw new Error("Catalog entries must not carry source text.");

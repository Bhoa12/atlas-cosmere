import { safeReadingUnits, validateCatalog, worldsForWork } from "./cosmereExpansionRun81";

const sources = [
  { id: "index", kind: "verified-index" as const, accessible: true },
  { id: "editorial", kind: "editorial-accessible" as const, accessible: true },
];
const worlds = [{ id: "scadrial", name: "Scadrial" }, { id: "sel", name: "Sel" }];
const works = [{ id: "work-a", title: "Catalog work", sourceId: "index" }];

const links = [{ worldId: "scadrial", workId: "work-a", sourceId: "index" }];
if (worldsForWork("work-a", links, worlds).map((w) => w.id).join() !== "scadrial") throw new Error("explicit links only");

const units = [{ id: "u1", workId: "work-a", position: 1, sourceId: "editorial" }];
if (safeReadingUnits("work-a", units, sources).length !== 1) throw new Error("accessible structure expected");

const invalid = [{ id: "u2", workId: "work-a", position: 1, sourceId: "index" }];
if (!validateCatalog(sources, worlds, works, [], invalid).some((e) => e.includes("unverified reading structure"))) {
  throw new Error("index must not authorize reading structure");
}

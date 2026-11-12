import { validateWorldWorkRegistry } from "./worldWorkRegistry";

const sources = ["catalogue-private"];
const worlds = [{ id: "scadrial", label: "Scadrial" }];
const works = [{ id: "synthetic-work", title: "Synthetic Work", worldId: "scadrial", sourceId: "catalogue-private" }];

if (!validateWorldWorkRegistry(worlds, works, sources)) throw new Error("valid registry rejected");
if (validateWorldWorkRegistry(worlds, [{ ...works[0], worldId: "unknown" }], sources)) throw new Error("unknown world accepted");
if (validateWorldWorkRegistry(worlds, [works[0], works[0]], sources)) throw new Error("duplicate work accepted");

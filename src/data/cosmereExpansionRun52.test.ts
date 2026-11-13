import { canReveal, validateCatalogue, priorityWorlds } from "./cosmereExpansionRun52";
import { cosmereSourcesRun52, cosmereWorksRun52 } from "./cosmereExpansionSeedRun52";

const errors = validateCatalogue({ sources: cosmereSourcesRun52, worlds: priorityWorlds, works: cosmereWorksRun52, units: [] });
if (errors.length !== 0) throw new Error(errors.join("; "));
if (cosmereWorksRun52.some(work => work.worldId)) throw new Error("seed must not infer world assignments");

const units = [
  { id: "u1", workId: "w", position: 1, label: "Synthetic unit 1" },
  { id: "u2", workId: "w", position: 2, label: "Synthetic unit 2" },
];
if (canReveal("w", ["u1", "u2"], { workId: "w", completedUnitIds: ["u1"] }, units)) throw new Error("must remain spoiler-locked");
if (!canReveal("w", ["u1", "u2"], { workId: "w", completedUnitIds: ["u1", "u2"] }, units)) throw new Error("must unlock when complete");
if (canReveal("w", ["u1", "u1"], { workId: "w", completedUnitIds: ["u1"] }, units)) throw new Error("duplicate requirements must fail closed");

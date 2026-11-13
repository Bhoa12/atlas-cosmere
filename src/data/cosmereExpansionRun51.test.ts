import { canReveal, validateCatalogue, type ExpansionCatalogue } from "./cosmereExpansionRun51";
import { cosmereExpansionSeed } from "./cosmereExpansionSeedRun51";

const base: ExpansionCatalogue = {
  sources: [{ id: "source", title: "Synthetic", status: "verified-index" }],
  worlds: [{ id: "world", title: "World" }],
  works: [{ id: "work", title: "Work", sourceId: "source" }],
  readingUnits: [{ id: "u1", workId: "work", position: 1, label: "Unit 1" }]
};

export function runCosmereExpansionRun51Checks(): void {
  if (validateCatalogue(cosmereExpansionSeed).length !== 0) throw new Error("seed should validate");
  if (cosmereExpansionSeed.works.some(work => work.worldId)) throw new Error("seed must not infer worlds");
  if (canReveal({ id: "gate", workId: "work", requiredUnitIds: ["u1"] }, { workId: "work", completedUnitIds: [] }, base.readingUnits)) throw new Error("incomplete progress must stay hidden");
  if (!canReveal({ id: "gate", workId: "work", requiredUnitIds: ["u1"] }, { workId: "work", completedUnitIds: ["u1"] }, base.readingUnits)) throw new Error("completed requirement should reveal");
  if (canReveal({ id: "gate", workId: "work", requiredUnitIds: ["u1", "u1"] }, { workId: "work", completedUnitIds: ["u1"] }, base.readingUnits)) throw new Error("duplicate requirements must fail closed");
}

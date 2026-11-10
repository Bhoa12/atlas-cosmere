import { describe, test } from "vitest";

type InvariantModule = Record<string, unknown>;

const modules = import.meta.glob<InvariantModule>("./*.test.ts", {
  eager: true,
});

const invariantEntries = Object.entries(modules)
  .flatMap(([path, module]) =>
    Object.entries(module)
      .filter(([name, value]) => name.endsWith("Invariants") && typeof value === "function")
      .map(([name, value]) => ({ path, name, run: value as () => void })),
  )
  .sort((a, b) => `${a.path}:${a.name}`.localeCompare(`${b.path}:${b.name}`));

describe("Hoid IA invariants", () => {
  if (invariantEntries.length === 0) {
    test("discovers at least one invariant", () => {
      throw new Error("No Hoid invariant functions were discovered.");
    });
  }

  for (const invariant of invariantEntries) {
    test(`${invariant.path} :: ${invariant.name}`, () => {
      invariant.run();
    });
  }
});

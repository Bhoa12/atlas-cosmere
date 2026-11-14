import { buildContextBudget, isScopeAuthorized } from "./contextBudget";

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Hoid context budget self-check failed: ${message}`);
}

const progress = Object.freeze({ "mistborn-1": 3, "elantris": 1 });
const budget = buildContextBudget(progress, [
  { workId: "mistborn-1", chapter: 3 },
  { workId: "mistborn-1", chapter: 4 },
  { workId: "unknown", chapter: 1 },
  { workId: "elantris", chapter: 1 },
  { workId: "elantris", chapter: 1 },
  { workId: "elantris", chapter: 0 },
]);

expect(budget.length === 2, "only reached, known, unique chapters may enter the budget");
expect(isScopeAuthorized(budget, { workId: "mistborn-1", chapter: 3 }), "reached scope should be authorized");
expect(!isScopeAuthorized(budget, { workId: "mistborn-1", chapter: 2 }), "unrequested earlier chapters are not implicitly added");
expect(!isScopeAuthorized(budget, { workId: "mistborn-1", chapter: 4 }), "future chapters must be denied");
expect(!isScopeAuthorized(budget, { workId: "elantris", chapter: 2 }), "progress is isolated per work");

console.info("Hoid context budget self-check passed.");

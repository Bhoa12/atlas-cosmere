import { recommendNextInPlan } from "./readingPlan";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Hoid reading plan selfcheck failed: ${message}`);
}

const catalog = ["mistborn-1", "mistborn-2", "mistborn-3", "elantris"];
const plan = [
  { bookId: "mistborn-1", title: "El Imperio Final", order: 1 },
  { bookId: "mistborn-2", title: "El Pozo de la Ascensión", order: 2 },
  { bookId: "mistborn-3", title: "El Héroe de las Eras", order: 3 },
];

function main(): void {
  const next = recommendNextInPlan(
    plan,
    { bookId: "mistborn-1", chapter: 12 },
    [],
    catalog,
  );
  assert(next.kind === "recommendation", "debe recomendar el siguiente libro del plan explícito");
  assert(next.bookId === "mistborn-2", "debe respetar el orden declarado por el lector");
  assert(next.reasonCode === "next-uncompleted-entry-in-explicit-plan",
    "la razón debe ser estructural y no narrativa");

  const skipCompleted = recommendNextInPlan(
    plan,
    { bookId: "mistborn-1", chapter: 12 },
    ["mistborn-2"],
    catalog,
  );
  assert(skipCompleted.kind === "recommendation" && skipCompleted.bookId === "mistborn-3",
    "debe saltar las obras marcadas como completadas");

  const unknownCurrent = recommendNextInPlan(
    plan,
    { bookId: "elantris", chapter: 1 },
    [],
    catalog,
  );
  assert(unknownCurrent.kind === "abstain" && unknownCurrent.reason === "current-book-not-in-plan",
    "no debe inventar posición para una obra fuera del plan");

  const unknownCatalogBook = recommendNextInPlan(
    [...plan, { bookId: "secret-book", title: "Obra desconocida", order: 4 }],
    { bookId: "mistborn-1", chapter: 1 },
    [],
    catalog,
  );
  assert(unknownCatalogBook.kind === "abstain" && unknownCatalogBook.reason === "invalid-plan",
    "el plan no puede introducir obras fuera del catálogo");

  const duplicateOrder = recommendNextInPlan(
    [
      plan[0],
      { ...plan[1], order: 1 },
      plan[2],
    ],
    { bookId: "mistborn-1", chapter: 1 },
    [],
    catalog,
  );
  assert(duplicateOrder.kind === "abstain", "los órdenes ambiguos deben rechazarse");

  const invalidProgress = recommendNextInPlan(
    plan,
    { bookId: "mistborn-1", chapter: 0 },
    [],
    catalog,
  );
  assert(invalidProgress.kind === "abstain" && invalidProgress.reason === "invalid-progress",
    "el progreso inválido debe provocar abstención");

  const completedAll = recommendNextInPlan(
    plan,
    { bookId: "mistborn-1", chapter: 1 },
    ["mistborn-2", "mistborn-3"],
    catalog,
  );
  assert(completedAll.kind === "abstain" && completedAll.reason === "no-next-entry",
    "si no hay siguiente obra pendiente debe abstenerse");

  const noUniversalOrder = recommendNextInPlan(
    [],
    { bookId: "mistborn-1", chapter: 1 },
    [],
    catalog,
  );
  assert(noUniversalOrder.kind === "abstain", "sin plan explícito no debe inventarse un orden Cosmere");

  console.log("Hoid reading plan selfcheck: 8 groups passed.");
}

main();

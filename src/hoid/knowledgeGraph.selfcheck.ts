import { getVisibleKnowledgeNeighborhood } from "./knowledgeGraph";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Hoid knowledge graph selfcheck failed: ${message}`);
}

const catalog = [
  { bookId: "book-a" },
  { bookId: "book-b" },
  { bookId: "book-c" },
];

const progressAtB3 = {
  schemaVersion: 1,
  revision: 2,
  entries: [
    { bookId: "book-a", chapter: 10, status: "reading", revision: 1 },
    { bookId: "book-b", chapter: 3, status: "paused", revision: 2 },
  ],
};

const progressAtB4 = {
  schemaVersion: 1,
  revision: 3,
  entries: [
    { bookId: "book-a", chapter: 10, status: "reading", revision: 1 },
    { bookId: "book-b", chapter: 4, status: "reading", revision: 3 },
  ],
};

const evidence = [
  { id: "ev-a9", bookId: "book-a", chapter: 9, accessible: true, summary: "Resumen original A9." },
  { id: "ev-a10", bookId: "book-a", chapter: 10, accessible: true, summary: "Resumen original A10." },
  { id: "ev-a11", bookId: "book-a", chapter: 11, accessible: true, summary: "Resumen original A11." },
  { id: "ev-b3", bookId: "book-b", chapter: 3, accessible: true, summary: "Resumen original B3." },
  { id: "ev-b4", bookId: "book-b", chapter: 4, accessible: true, summary: "Resumen original B4." },
  { id: "ev-b5", bookId: "book-b", chapter: 5, accessible: true, summary: "Resumen original B5." },
  { id: "ev-c1", bookId: "book-c", chapter: 1, accessible: true, summary: "Resumen original C1." },
  { id: "ev-private", bookId: "book-a", chapter: 9, accessible: false, summary: "Fuente no accesible." },
];

const graph = {
  entities: [
    {
      id: "entity-a",
      kind: "character",
      label: "Entidad A",
      revealAfter: [{ bookId: "book-a", chapter: 8 }],
      evidenceIds: ["ev-a9"],
    },
    {
      id: "entity-b",
      kind: "place",
      label: "Entidad B",
      revealAfter: [{ bookId: "book-b", chapter: 3 }],
      evidenceIds: ["ev-b3"],
    },
    {
      id: "entity-d",
      kind: "concept",
      label: "Entidad D",
      revealAfter: [
        { bookId: "book-a", chapter: 10 },
        { bookId: "book-b", chapter: 4 },
      ],
      evidenceIds: ["ev-a10", "ev-b4"],
    },
    {
      id: "entity-future",
      kind: "event",
      label: "Entidad futura",
      revealAfter: [{ bookId: "book-a", chapter: 11 }],
      evidenceIds: ["ev-a11"],
    },
    {
      id: "entity-private",
      kind: "object",
      label: "Entidad sin fuente accesible",
      revealAfter: [{ bookId: "book-a", chapter: 9 }],
      evidenceIds: ["ev-private"],
    },
    {
      id: "entity-c",
      kind: "organization",
      label: "Entidad de otra obra",
      revealAfter: [{ bookId: "book-c", chapter: 1 }],
      evidenceIds: ["ev-c1"],
    },
  ],
  relations: [
    {
      id: "relation-a-b",
      fromEntityId: "entity-a",
      toEntityId: "entity-b",
      kind: "related_to",
      label: "Relación entre A y B",
      revealAfter: [
        { bookId: "book-a", chapter: 9 },
        { bookId: "book-b", chapter: 4 },
      ],
      evidenceIds: ["ev-a9", "ev-b4"],
    },
    {
      id: "relation-a-d",
      fromEntityId: "entity-a",
      toEntityId: "entity-d",
      kind: "part_of",
      label: "Relación transversal",
      revealAfter: [
        { bookId: "book-a", chapter: 10 },
        { bookId: "book-b", chapter: 4 },
      ],
      evidenceIds: ["ev-a10", "ev-b4"],
    },
    {
      id: "relation-future-evidence",
      fromEntityId: "entity-a",
      toEntityId: "entity-b",
      kind: "uses",
      label: "Relación respaldada más adelante",
      revealAfter: [
        { bookId: "book-a", chapter: 9 },
        { bookId: "book-b", chapter: 4 },
      ],
      evidenceIds: ["ev-a9", "ev-b5"],
    },
    {
      id: "relation-hidden-endpoint",
      fromEntityId: "entity-a",
      toEntityId: "entity-future",
      kind: "causes",
      label: "Relación con un extremo futuro",
      revealAfter: [{ bookId: "book-a", chapter: 10 }],
      evidenceIds: ["ev-a10"],
    },
  ],
};

function query(
  subject: unknown,
  progress: unknown = progressAtB3,
  graphInput: unknown = graph,
  evidenceInput: unknown = evidence,
) {
  return getVisibleKnowledgeNeighborhood(
    graphInput,
    subject,
    progress,
    catalog,
    evidenceInput,
  );
}

function main(): void {
  const initial = query("entity-a");
  assert(initial.kind === "neighborhood", "debe devolver el nodo raíz ya descubierto");
  assert(initial.relatedEntities.length === 0 && initial.relations.length === 0,
    "no debe revelar una relación cuyo umbral de otro libro aún no se ha alcanzado");
  assert(initial.subject.label === "Entidad A", "debe devolver la etiqueta autorizada del nodo raíz");

  const futureNode = query("entity-future");
  assert(futureNode.kind === "abstain" && futureNode.reason === "no-visible-knowledge",
    "un nodo de capítulo futuro debe permanecer invisible");

  const otherWork = query("entity-c");
  assert(otherWork.kind === "abstain" && otherWork.reason === "no-visible-knowledge",
    "la ausencia de progreso de otra obra debe bloquear sus nodos");

  const unknown = query("not-in-graph");
  assert(unknown.kind === "abstain" && unknown.reason === "unknown-entity",
    "un identificador desconocido debe producir una abstención explícita");

  const inaccessible = query("entity-private");
  assert(inaccessible.kind === "abstain" && inaccessible.reason === "no-visible-knowledge",
    "un nodo respaldado solo por una fuente inaccesible no debe mostrarse");

  const advanced = query("entity-a", progressAtB4);
  assert(advanced.kind === "neighborhood", "el progreso actualizado debe permitir una nueva evaluación");
  assert(advanced.relations.length === 2,
    "debe revelar solo las relaciones cuyos umbrales multiobra y evidencias ya se han alcanzado");
  assert(advanced.relatedEntities.length === 2,
    "debe incluir únicamente los extremos de relaciones visibles");
  assert(!advanced.relations.some((item) => item.id === "relation-future-evidence"),
    "una evidencia de capítulo futuro debe bloquear la relación aunque su umbral se haya alcanzado");
  assert(!advanced.relations.some((item) => item.id === "relation-hidden-endpoint"),
    "una relación no debe revelar un extremo que aún no es visible");

  const progressAtB5 = {
    ...progressAtB4,
    revision: 4,
    entries: [
      progressAtB4.entries[0],
      { bookId: "book-b", chapter: 5, status: "reading", revision: 4 },
    ],
  };
  const later = query("entity-a", progressAtB5);
  assert(later.kind === "neighborhood" &&
    later.relations.some((item) => item.id === "relation-future-evidence"),
  "la relación solo debe aparecer después de alcanzar también su evidencia");

  const noBookBProgress = {
    schemaVersion: 1,
    revision: 1,
    entries: [
      { bookId: "book-a", chapter: 10, status: "reading", revision: 1 },
    ],
  };
  const missingBookProgress = query("entity-a", noBookBProgress);
  assert(missingBookProgress.kind === "neighborhood" &&
    missingBookProgress.relations.length === 0,
  "un libro sin progreso no debe satisfacer un requisito transversal");

  const duplicateEvidence = query("entity-a", progressAtB3, graph, [...evidence, evidence[0]]);
  assert(duplicateEvidence.kind === "abstain" && duplicateEvidence.reason === "invalid-evidence",
    "los identificadores de evidencia duplicados deben invalidar la entrada");

  const invalidProgress = query("entity-a", {
    schemaVersion: 1,
    revision: 2,
    entries: [
      ...progressAtB3.entries,
      { bookId: "book-a", chapter: 11, status: "reading", revision: 2 },
    ],
  });
  assert(invalidProgress.kind === "abstain" && invalidProgress.reason === "invalid-progress",
    "un ledger ambiguo o duplicado debe rechazarse");

  const duplicateEntityGraph = {
    ...graph,
    entities: [...graph.entities, graph.entities[0]],
  };
  const duplicateEntity = query("entity-a", progressAtB3, duplicateEntityGraph);
  assert(duplicateEntity.kind === "abstain" && duplicateEntity.reason === "invalid-graph",
    "los identificadores de entidad duplicados deben invalidar el grafo");

  const unknownEvidenceGraph = {
    ...graph,
    entities: graph.entities.map((item) => item.id === "entity-a"
      ? { ...item, evidenceIds: ["missing-evidence"] }
      : item),
  };
  const unknownEvidence = query("entity-a", progressAtB3, unknownEvidenceGraph);
  assert(unknownEvidence.kind === "abstain" && unknownEvidence.reason === "invalid-graph",
    "un nodo visible con una referencia de evidencia inexistente debe provocar abstención");

  const invalidGateGraph = {
    ...graph,
    entities: graph.entities.map((item) => item.id === "entity-a"
      ? { ...item, revealAfter: [{ bookId: "unknown-book", chapter: 1 }] }
      : item),
  };
  const invalidGate = query("entity-a", progressAtB3, invalidGateGraph);
  assert(invalidGate.kind === "abstain" && invalidGate.reason === "invalid-graph",
    "un umbral referido a una obra fuera del catálogo debe rechazarse");

  const invalidCatalog = getVisibleKnowledgeNeighborhood(graph, "entity-a", progressAtB3, [], evidence);
  assert(invalidCatalog.kind === "abstain" && invalidCatalog.reason === "invalid-catalog",
    "un catálogo vacío debe rechazarse");

  console.log("Hoid knowledge graph selfcheck: 16 assertions passed.");
}

main();

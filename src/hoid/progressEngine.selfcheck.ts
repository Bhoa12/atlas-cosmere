import {
  applyProgressCommand,
  completedBookIds,
  emptyProgressLedger,
  parseProgressLedger,
  persistProgressCommand,
  selectBookProgress,
  type ProgressLedger,
  type ProgressStore,
} from "./progressEngine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Hoid progress engine selfcheck failed: ${message}`);
}

const catalog = [
  { bookId: "mistborn-era1-book1", chapterCount: 38 },
  { bookId: "elantris" },
];

function command(
  type: "set-position" | "set-status",
  bookId: string,
  expectedRevision: number,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return { type, bookId, expectedRevision, ...extra };
}

class MemoryStore implements ProgressStore {
  value: unknown = null;

  async read(): Promise<unknown> {
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: ProgressLedger): Promise<boolean> {
    const currentRevision = this.value === null
      ? 0
      : (this.value as ProgressLedger).revision;
    if (currentRevision !== expectedRevision) return false;
    this.value = next;
    return true;
  }
}

async function main(): Promise<void> {
  const empty = emptyProgressLedger();
  assert(empty.revision === 0 && empty.entries.length === 0, "el ledger inicial debe estar vacío y versionado");

  const first = applyProgressCommand(
    null,
    command("set-position", "mistborn-era1-book1", 0, { chapter: 3 }),
    catalog,
  );
  assert(first.kind === "updated" && first.ledger.revision === 1,
    "debe crear el progreso de la primera obra");
  assert(first.ledger.entries[0].status === "reading" && first.ledger.entries[0].chapter === 3,
    "la primera posición debe quedar en estado reading");

  const second = applyProgressCommand(
    first.ledger,
    command("set-position", "elantris", 1, { chapter: 1 }),
    catalog,
  );
  assert(second.kind === "updated" && second.ledger.entries.length === 2,
    "debe mantener progreso simultáneo de varias obras");

  const advance = applyProgressCommand(
    second.ledger,
    command("set-position", "mistborn-era1-book1", 2, { chapter: 4 }),
    catalog,
  );
  assert(advance.kind === "updated" && advance.ledger.revision === 3,
    "debe permitir avanzar con la revisión esperada");
  assert(advance.ledger.entries.find((entry) => entry.bookId === "elantris")?.chapter === 1,
    "actualizar una obra no debe alterar el progreso de otra");

  const regression = applyProgressCommand(
    advance.ledger,
    command("set-position", "mistborn-era1-book1", 3, { chapter: 2 }),
    catalog,
  );
  assert(regression.kind === "abstain" && regression.reason === "position-regression",
    "un retroceso accidental debe rechazarse");

  const correction = applyProgressCommand(
    advance.ledger,
    command("set-position", "mistborn-era1-book1", 3, {
      chapter: 2,
      confirmedCorrection: true,
    }),
    catalog,
  );
  assert(correction.kind === "updated" && correction.ledger.entries
    .find((entry) => entry.bookId === "mistborn-era1-book1")?.chapter === 2,
  "un retroceso explícitamente confirmado debe corregir la posición");

  const stale = applyProgressCommand(
    correction.kind === "updated" ? correction.ledger : advance.ledger,
    command("set-position", "elantris", 3, { chapter: 2 }),
    catalog,
  );
  assert(stale.kind === "abstain" && stale.reason === "stale-revision",
    "una escritura basada en una revisión obsoleta debe rechazarse");

  const earlyCompletion = applyProgressCommand(
    correction.kind === "updated" ? correction.ledger : advance.ledger,
    command("set-status", "mistborn-era1-book1", 4, {
      status: "completed",
      confirmed: true,
    }),
    catalog,
  );
  assert(earlyCompletion.kind === "abstain" &&
    earlyCompletion.reason === "completion-before-final-chapter",
  "no debe marcarse completada una obra con recuento verificado si faltan capítulos");

  const toFinalChapter = applyProgressCommand(
    correction.kind === "updated" ? correction.ledger : advance.ledger,
    command("set-position", "mistborn-era1-book1", 4, { chapter: 38 }),
    catalog,
  );
  assert(toFinalChapter.kind === "updated", "debe aceptar el último capítulo del catálogo");

  const unconfirmedCompletion = applyProgressCommand(
    toFinalChapter.kind === "updated" ? toFinalChapter.ledger : empty,
    command("set-status", "mistborn-era1-book1", 5, { status: "completed" }),
    catalog,
  );
  assert(unconfirmedCompletion.kind === "abstain" &&
    unconfirmedCompletion.reason === "invalid-command",
  "la finalización debe exigir confirmación explícita en el contrato");

  const confirmedCompletion = applyProgressCommand(
    toFinalChapter.kind === "updated" ? toFinalChapter.ledger : empty,
    command("set-status", "mistborn-era1-book1", 5, {
      status: "completed",
      confirmed: true,
    }),
    catalog,
  );
  assert(confirmedCompletion.kind === "updated" &&
    confirmedCompletion.ledger.entries.find((entry) => entry.bookId === "mistborn-era1-book1")?.status === "completed",
  "debe aceptar la finalización explícita cuando se alcanza el capítulo final verificado");

  const unconfirmedReopen = applyProgressCommand(
    confirmedCompletion.kind === "updated" ? confirmedCompletion.ledger : empty,
    command("set-status", "mistborn-era1-book1", 6, { status: "reading" }),
    catalog,
  );
  assert(unconfirmedReopen.kind === "abstain" && unconfirmedReopen.reason === "invalid-command",
    "reabrir una obra completada debe requerir confirmación");

  const reopened = applyProgressCommand(
    confirmedCompletion.kind === "updated" ? confirmedCompletion.ledger : empty,
    command("set-status", "mistborn-era1-book1", 6, {
      status: "reading",
      confirmed: true,
    }),
    catalog,
  );
  assert(reopened.kind === "updated" &&
    reopened.ledger.entries.find((entry) => entry.bookId === "mistborn-era1-book1")?.status === "reading",
  "debe permitir reabrir explícitamente una obra");

  const unknownBook = applyProgressCommand(
    null,
    command("set-position", "unknown-book", 0, { chapter: 1 }),
    catalog,
  );
  assert(unknownBook.kind === "abstain" && unknownBook.reason === "unknown-book",
    "no debe guardarse progreso para una obra fuera del catálogo");

  const outOfRange = applyProgressCommand(
    null,
    command("set-position", "mistborn-era1-book1", 0, { chapter: 39 }),
    catalog,
  );
  assert(outOfRange.kind === "abstain" && outOfRange.reason === "chapter-out-of-range",
    "un recuento de capítulos verificado debe actuar como límite superior");

  const duplicateLedger = {
    schemaVersion: 1,
    revision: 2,
    entries: [
      { bookId: "elantris", chapter: 1, status: "reading", revision: 1 },
      { bookId: "elantris", chapter: 2, status: "reading", revision: 2 },
    ],
  };
  assert(parseProgressLedger(duplicateLedger, catalog) === null,
    "un ledger con dos posiciones para la misma obra debe ser inválido");

  const selected = selectBookProgress(
    second.kind === "updated" ? second.ledger : empty,
    "mistborn-era1-book1",
    catalog,
  );
  assert(selected.kind === "progress" && selected.progress.chapter === 3,
    "debe seleccionar el progreso exacto de la obra solicitada");

  const missing = selectBookProgress(null, "elantris", catalog);
  assert(missing.kind === "abstain" && missing.reason === "no-progress",
    "la ausencia de progreso debe ser explícita y no inferirse");

  const completed = confirmedCompletion.kind === "updated"
    ? completedBookIds(confirmedCompletion.ledger)
    : [];
  assert(completed.length === 1 && completed[0] === "mistborn-era1-book1",
    "el plan de lectura debe recibir solo obras marcadas completadas");

  const store = new MemoryStore();
  const persisted = await persistProgressCommand(
    store,
    command("set-position", "elantris", 0, { chapter: 2 }),
    catalog,
  );
  assert(persisted.kind === "updated" && (store.value as ProgressLedger).revision === 1,
    "el adaptador debe persistir mediante compare-and-swap");

  const racingStore: ProgressStore = {
    async read() { return null; },
    async compareAndSwap() { return false; },
  };
  const race = await persistProgressCommand(
    racingStore,
    command("set-position", "elantris", 0, { chapter: 2 }),
    catalog,
  );
  assert(race.kind === "abstain" && race.reason === "concurrent-update",
    "una carrera de escrituras debe provocar rechazo y no sobrescritura");

  const failingStore: ProgressStore = {
    async read() { throw new Error("storage unavailable"); },
    async compareAndSwap() { return false; },
  };
  const storageFailure = await persistProgressCommand(
    failingStore,
    command("set-position", "elantris", 0, { chapter: 2 }),
    catalog,
  );
  assert(storageFailure.kind === "abstain" && storageFailure.reason === "storage-failure",
    "un fallo del almacenamiento debe producir abstención controlada");

  console.log("Hoid progress engine selfcheck: 18 groups passed.");
}

void main();

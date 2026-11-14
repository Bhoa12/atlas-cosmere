/**
 * Hoid IA — contrato de progreso de lectura.
 *
 * Esta capa convierte el progreso declarado por el lector en una frontera
 * explícita y conservadora. No contiene hechos narrativos ni texto de obras.
 */

export type ReadingProgress = Readonly<{
  workId: string;
  chapter: number;
}>;

export type ProgressBoundary = Readonly<{
  readonly chaptersByWork: ReadonlyMap<string, number>;
}>;

export function buildProgressBoundary(
  entries: readonly ReadingProgress[],
): ProgressBoundary {
  const chaptersByWork = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.workId.trim() || !Number.isInteger(entry.chapter) || entry.chapter < 0) {
      throw new Error("Invalid reading progress");
    }

    const previous = chaptersByWork.get(entry.workId);
    chaptersByWork.set(
      entry.workId,
      previous === undefined ? entry.chapter : Math.max(previous, entry.chapter),
    );
  }

  return { chaptersByWork };
}

/**
 * Devuelve true únicamente cuando el capítulo solicitado está dentro del
 * progreso declarado para la misma obra. Una obra sin progreso explícito no
 * queda autorizada.
 */
export function isWithinProgress(
  boundary: ProgressBoundary,
  workId: string,
  chapter: number,
): boolean {
  if (!workId.trim() || !Number.isInteger(chapter) || chapter < 0) return false;
  const reached = boundary.chaptersByWork.get(workId);
  return reached !== undefined && chapter <= reached;
}

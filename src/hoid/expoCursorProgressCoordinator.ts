import { getExpoHoidDatabase } from "./expoHoidDatabase";
import { createExpoSqliteHoidCursorProgressStore, type HoidCursorProgressStore } from "./cursorSqliteProgressStore";
import { HoidCursorProgressCoordinator } from "./cursorProgressCoordinator";

export type HoidExpoCursorProgressRuntime = Readonly<{
  /** The exact SQLite store instance used to construct the reader coordinator. */
  store: HoidCursorProgressStore;
  /** The process-wide coordinator also used by CosmereContext. */
  coordinator: HoidCursorProgressCoordinator;
}>;

let runtimePromise: Promise<HoidExpoCursorProgressRuntime> | null = null;

/**
 * Native composition boundary for cursor-native progress.
 *
 * Atlas and Hoid must share both this store and coordinator. Opening another
 * store/coordinator pair would create a second in-memory authority and could
 * miss reader invalidation events even if both happened to use the same file.
 * The shared database provider coalesces concurrent opens, including React
 * Strict Mode remounts. Web remains unavailable until a separately tested
 * transactional store exists.
 */
export function getExpoHoidCursorProgressRuntime(): Promise<HoidExpoCursorProgressRuntime> {
  if (!runtimePromise) {
    runtimePromise = getExpoHoidDatabase()
      .then(database => {
        const store = createExpoSqliteHoidCursorProgressStore(database);
        const coordinator = new HoidCursorProgressCoordinator(store);
        return Object.freeze({ store, coordinator });
      })
      .catch(error => {
        // A failed native open must be retryable on a later screen mount.
        runtimePromise = null;
        throw error;
      });
  }

  return runtimePromise;
}

/** Compatibility entry point used by CosmereContext. */
export async function createExpoHoidCursorProgressCoordinator(): Promise<HoidCursorProgressCoordinator> {
  return (await getExpoHoidCursorProgressRuntime()).coordinator;
}

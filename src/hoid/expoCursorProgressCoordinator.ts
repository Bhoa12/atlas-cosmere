import { getExpoHoidDatabase } from "./expoHoidDatabase";
import { createExpoSqliteHoidCursorProgressStore } from "./cursorSqliteProgressStore";
import { HoidCursorProgressCoordinator } from "./cursorProgressCoordinator";

let coordinatorPromise: Promise<HoidCursorProgressCoordinator> | null = null;

/**
 * Native composition boundary for cursor-native progress.
 *
 * The coordinator and future conversation-history stores obtain the same
 * process-local SQLite handle from expoHoidDatabase.ts. The shared provider
 * coalesces concurrent opens, including React Strict Mode remounts. Web
 * remains unavailable until a separately tested transactional store exists.
 */
export function createExpoHoidCursorProgressCoordinator(): Promise<HoidCursorProgressCoordinator> {
  if (!coordinatorPromise) {
    coordinatorPromise = getExpoHoidDatabase()
      .then(database => {
        const store = createExpoSqliteHoidCursorProgressStore(database);
        return new HoidCursorProgressCoordinator(store);
      })
      .catch(error => {
        coordinatorPromise = null;
        throw error;
      });
  }

  return coordinatorPromise;
}

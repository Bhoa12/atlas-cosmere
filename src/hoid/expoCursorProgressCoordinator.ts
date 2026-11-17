import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import {
  createExpoSqliteHoidCursorProgressStore,
  type HoidSqliteDatabasePort,
} from "./cursorSqliteProgressStore";
import { HoidCursorProgressCoordinator } from "./cursorProgressCoordinator";

let coordinatorPromise: Promise<HoidCursorProgressCoordinator> | null = null;

/**
 * Native composition boundary for cursor-native progress.
 *
 * This factory intentionally remains separate from the v1 application
 * composition until native migration and rollback tests have passed.
 * The shared promise prevents duplicate connections during React Strict Mode
 * remounts. Web remains unavailable until a separately tested transactional
 * store is supplied.
 */
export function createExpoHoidCursorProgressCoordinator(): Promise<HoidCursorProgressCoordinator> {
  if (Platform.OS === "web") {
    return Promise.reject(new Error(
      "Hoid cursor progress currently requires native SQLite transactions.",
    ));
  }

  if (!coordinatorPromise) {
    coordinatorPromise = SQLite.openDatabaseAsync("atlas-cosmere-hoid.db")
      .then(database => {
        const store = createExpoSqliteHoidCursorProgressStore(
          database as unknown as HoidSqliteDatabasePort,
        );
        return new HoidCursorProgressCoordinator(store);
      })
      .catch(error => {
        coordinatorPromise = null;
        throw error;
      });
  }

  return coordinatorPromise;
}

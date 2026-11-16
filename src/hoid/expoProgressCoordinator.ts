import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { HoidProgressCoordinator } from "./progressCoordinator";
import {
  createExpoSqliteHoidProgressStore,
  type HoidSqliteDatabasePort,
} from "./sqliteProgressStore";

let coordinatorPromise: Promise<HoidProgressCoordinator> | null = null;

/**
 * Native composition boundary. The core coordinator and ledger remain free of
 * Expo imports. SDK 51 uses the rewritten async SQLite API; web is rejected
 * until a separately tested web transaction adapter is supplied.
 *
 * The shared promise also makes React Strict Mode remounts reuse one database
 * connection and one in-memory revision coordinator per JavaScript runtime.
 */
export function createExpoHoidProgressCoordinator(): Promise<HoidProgressCoordinator> {
  if (Platform.OS === "web") {
    return Promise.reject(new Error("Hoid progress persistence currently requires native SQLite transactions."));
  }

  if (!coordinatorPromise) {
    coordinatorPromise = SQLite.openDatabaseAsync("atlas-cosmere-hoid.db")
      .then(database => {
        const store = createExpoSqliteHoidProgressStore(
          database as unknown as HoidSqliteDatabasePort,
        );
        return new HoidProgressCoordinator(store);
      })
      .catch(error => {
        // A failed native module/database initialization must be retryable.
        coordinatorPromise = null;
        throw error;
      });
  }

  return coordinatorPromise;
}

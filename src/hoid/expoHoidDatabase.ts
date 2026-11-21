import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import type { HoidSqliteDatabasePort } from "./sqliteProgressStore";
import { createHoidSharedSqliteDatabaseProvider } from "./sharedSqliteDatabase";

export const HOID_SQLITE_DATABASE_NAME = "atlas-cosmere-hoid.db" as const;

const databaseProvider = createHoidSharedSqliteDatabaseProvider(
  async (): Promise<HoidSqliteDatabasePort> => {
    if (Platform.OS === "web") {
      throw new Error(
        "Hoid persistence requires native SQLite transactions; web is unavailable.",
      );
    }

    const database = await SQLite.openDatabaseAsync(HOID_SQLITE_DATABASE_NAME);
    return database as unknown as HoidSqliteDatabasePort;
  },
);

/**
 * Returns the one process-local Expo SQLite handle used by Hoid persistence.
 *
 * Cursor progress and conversation history must obtain this handle through
 * this function rather than opening the database independently. The handle
 * remains shared for the module lifetime; consumers must not close it.
 */
export function getExpoHoidDatabase(): Promise<HoidSqliteDatabasePort> {
  return databaseProvider.get();
}

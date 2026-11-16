import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { HoidProgressCoordinator } from "./progressCoordinator";
import {
  createExpoSqliteHoidProgressStore,
  type HoidSqliteDatabasePort,
} from "./sqliteProgressStore";

/**
 * Native composition boundary. The core coordinator and ledger remain free of
 * Expo imports. SDK 51 uses the rewritten async SQLite API; web is rejected
 * until a separately tested web transaction adapter is supplied.
 */
export async function createExpoHoidProgressCoordinator(): Promise<HoidProgressCoordinator> {
  if (Platform.OS === "web") {
    throw new Error("Hoid progress persistence currently requires native SQLite transactions.");
  }

  const database = await SQLite.openDatabaseAsync("atlas-cosmere-hoid.db");
  const store = createExpoSqliteHoidProgressStore(
    database as unknown as HoidSqliteDatabasePort,
  );
  return new HoidProgressCoordinator(store);
}

import {
  getDefaultHoidReaderRecommendationPreferences,
  validateHoidReaderRecommendationPreferences,
  type HoidReaderRecommendationPreferences,
  type HoidReaderRecommendationPreferencesStorePort,
} from "./readerRecommendationPreferences";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

type PreferencesRow = Readonly<{
  schema_version: number;
  revision: number;
  payload: string;
}>;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_reader_recommendation_preferences_v1 (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    payload TEXT NOT NULL
  )
`;
const INSERT_INITIAL_SQL = `
  INSERT OR IGNORE INTO hoid_reader_recommendation_preferences_v1
    (id, schema_version, revision, payload)
  VALUES (1, ?, ?, ?)
`;
const SELECT_PREFERENCES_SQL = `
  SELECT schema_version, revision, payload
  FROM hoid_reader_recommendation_preferences_v1
  WHERE id = 1
`;
const UPDATE_PREFERENCES_SQL = `
  UPDATE hoid_reader_recommendation_preferences_v1
  SET schema_version = ?, revision = ?, payload = ?
  WHERE id = 1 AND revision = ?
`;

const INVALID_STORED_VALUE = Object.freeze({
  schemaVersion: 0,
  invalidStoredPreferences: true,
});

function isSqliteBusyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") return true;
  return typeof candidate.message === "string" &&
    /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(candidate.message);
}

function decodeRow(row: PreferencesRow | null): HoidReaderRecommendationPreferences | null {
  if (
    !row ||
    row.schema_version !== 1 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    typeof row.payload !== "string"
  ) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payload) as unknown;
  } catch {
    return null;
  }

  const validation = validateHoidReaderRecommendationPreferences(parsed);
  if (
    validation.status !== "valid" ||
    validation.preferences.revision !== row.revision
  ) return null;

  return validation.preferences;
}

/**
 * Single-device, single-reader SQLite persistence for Hoid's metadata-only
 * recommendation preferences. It deliberately shares the host-owned database
 * handle and never opens or closes a connection itself.
 *
 * A corrupt existing row is never treated as an empty profile and is never
 * overwritten by a guessed revision. Multi-profile support requires a new
 * partitioned schema rather than changing the meaning of this singleton row.
 */
export class ExpoSqliteHoidReaderRecommendationPreferencesStore
implements HoidReaderRecommendationPreferencesStorePort {
  private initialization: Promise<void> | null = null;

  constructor(private readonly database: HoidSqliteDatabasePort) {}

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;

    const defaults = getDefaultHoidReaderRecommendationPreferences();
    this.initialization = this.database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_TABLE_SQL);
      await transaction.runAsync(
        INSERT_INITIAL_SQL,
        defaults.schemaVersion,
        defaults.revision,
        JSON.stringify(defaults),
      );
    }).catch(error => {
      // A failed schema setup is retryable; a later operation can reopen it.
      this.initialization = null;
      throw error;
    });

    return this.initialization;
  }

  async read(): Promise<unknown> {
    await this.ensureInitialized();
    const row = await this.database.getFirstAsync<PreferencesRow>(SELECT_PREFERENCES_SQL);
    return decodeRow(row) ?? INVALID_STORED_VALUE;
  }

  async compareAndSwap(
    expectedRevision: number,
    nextInput: HoidReaderRecommendationPreferences,
  ): Promise<"saved" | "conflict" | "unavailable"> {
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      !Number.isSafeInteger(expectedRevision + 1)
    ) return "unavailable";

    const validation = validateHoidReaderRecommendationPreferences(nextInput);
    if (
      validation.status !== "valid" ||
      validation.preferences.revision !== expectedRevision + 1
    ) return "unavailable";

    await this.ensureInitialized();
    const next = validation.preferences;
    const payload = JSON.stringify(next);
    if (typeof payload !== "string") return "unavailable";

    let outcome: "saved" | "conflict" | "unavailable" = "conflict";
    try {
      await this.database.withExclusiveTransactionAsync(async transaction => {
        const currentRow = await transaction.getFirstAsync<PreferencesRow>(
          SELECT_PREFERENCES_SQL,
        );
        const current = decodeRow(currentRow);
        if (!current) {
          outcome = "unavailable";
          return;
        }
        if (current.revision !== expectedRevision) {
          outcome = "conflict";
          return;
        }

        const result = await transaction.runAsync(
          UPDATE_PREFERENCES_SQL,
          next.schemaVersion,
          next.revision,
          payload,
          expectedRevision,
        );
        outcome = result.changes === 1 ? "saved" : "conflict";
      });
    } catch (error) {
      // Lock contention is a retryable CAS conflict; other failures remain
      // unavailable and can never be mistaken for a committed preference.
      return isSqliteBusyError(error) ? "conflict" : "unavailable";
    }

    return outcome;
  }
}

/** Explicit factory: database opening and lifecycle remain host-owned. */
export function createExpoSqliteHoidReaderRecommendationPreferencesStore(
  database: HoidSqliteDatabasePort,
): HoidReaderRecommendationPreferencesStorePort {
  return new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
}

// Keep the SQL value type visible to adapter conformance tests without
// coupling the preference core to Expo's concrete SDK.
export type HoidReaderPreferencesSqliteValue = HoidSqliteBindValue;
export type HoidReaderPreferencesSqliteRunResult = HoidSqliteRunResult;
export type HoidReaderPreferencesSqliteTransaction = HoidSqliteTransactionPort;

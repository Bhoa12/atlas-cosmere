import { getExpoHoidDatabase } from "./expoHoidDatabase";
import {
  createExpoSqliteHoidReaderRecommendationPreferencesStore,
} from "./sqliteReaderRecommendationPreferencesStore";
import type {
  HoidReaderRecommendationPreferencesStorePort,
} from "./readerRecommendationPreferences";

let storePromise: Promise<HoidReaderRecommendationPreferencesStorePort> | null = null;

/**
 * Returns the process-wide local preference store. It reuses the same
 * atlas-cosmere-hoid.db handle as cursor progress and does not open a second
 * SQLite connection. Web remains unavailable until a transactional web store
 * has its own reviewed implementation.
 */
export function getExpoHoidReaderRecommendationPreferencesStore():
Promise<HoidReaderRecommendationPreferencesStorePort> {
  if (!storePromise) {
    storePromise = getExpoHoidDatabase()
      .then(database => createExpoSqliteHoidReaderRecommendationPreferencesStore(database))
      .catch(error => {
        // Failed native initialization must be retryable on a later attempt.
        storePromise = null;
        throw error;
      });
  }
  return storePromise;
}

import { getExpoHoidDatabase } from "./expoHoidDatabase";
import {
  createExpoSqliteHoidEditorialReviewReceiptStore,
} from "./sqliteEditorialReviewReceiptStore";
import type {
  HoidEditorialReviewReceiptStorePort,
} from "./editorialReviewReceiptStore";

let storePromise: Promise<HoidEditorialReviewReceiptStorePort> | null = null;

/**
 * Returns the process-wide device-local review receipt store. It shares the
 * same SQLite database handle as progress and reader preferences. A failed
 * native initialization is retryable; web remains unavailable until a
 * separately reviewed transactional store exists.
 */
export function getExpoHoidEditorialReviewReceiptStore():
Promise<HoidEditorialReviewReceiptStorePort> {
  if (!storePromise) {
    storePromise = getExpoHoidDatabase()
      .then(database => createExpoSqliteHoidEditorialReviewReceiptStore(database))
      .catch(error => {
        storePromise = null;
        throw error;
      });
  }
  return storePromise;
}

import { getExpoHoidDatabase } from "./expoHoidDatabase";
import {
  createExpoSqliteHoidSourceInspectionReceiptStore,
} from "./sqliteSourceInspectionReceiptStore";
import type {
  HoidSourceInspectionReceiptStorePort,
} from "./sourceInspectionReceipts";

let storePromise: Promise<HoidSourceInspectionReceiptStorePort> | null = null;

/**
 * Returns the process-wide local receipt store using Atlas's shared Hoid
 * SQLite connection. Web remains unavailable until it has a reviewed
 * transactional store implementation of its own.
 */
export function getExpoHoidSourceInspectionReceiptStore():
Promise<HoidSourceInspectionReceiptStorePort> {
  if (!storePromise) {
    storePromise = getExpoHoidDatabase()
      .then(database => createExpoSqliteHoidSourceInspectionReceiptStore(database))
      .catch(error => {
        // A transient native database failure must not poison future attempts.
        storePromise = null;
        throw error;
      });
  }
  return storePromise;
}

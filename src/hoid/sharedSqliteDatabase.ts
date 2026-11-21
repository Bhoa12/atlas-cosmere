/**
 * Process-local, provider-neutral singleton for an asynchronously opened
 * SQLite database handle.
 *
 * The provider coalesces concurrent opens, retains a successful handle for
 * the lifetime of the module, and clears a rejected open so a later call can
 * retry. It deliberately exposes no close/reset operation: one consumer must
 * not invalidate a handle while another store is using it.
 */
export type HoidSharedSqliteDatabaseProvider<TDatabase> = Readonly<{
  get: () => Promise<TDatabase>;
}>;

export function createHoidSharedSqliteDatabaseProvider<TDatabase>(
  openDatabase: () => Promise<TDatabase>,
): HoidSharedSqliteDatabaseProvider<TDatabase> {
  if (typeof openDatabase !== "function") {
    throw new TypeError("A SQLite database opener is required");
  }

  let databasePromise: Promise<TDatabase> | null = null;

  const get = (): Promise<TDatabase> => {
    if (databasePromise) return databasePromise;

    const sharedPromise = Promise.resolve()
      .then(openDatabase)
      .catch(error => {
        // A new attempt cannot start until this rejection handler runs because
        // the current promise remains cached while the opener is in flight.
        databasePromise = null;
        throw error;
      });

    databasePromise = sharedPromise;
    return sharedPromise;
  };

  return Object.freeze({ get });
}

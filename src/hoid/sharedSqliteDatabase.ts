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

    let sharedPromise: Promise<TDatabase>;
    sharedPromise = Promise.resolve()
      .then(openDatabase)
      .catch(error => {
        // Do not clear a newer attempt if the provider is ever extended with
        // additional lifecycle behavior.
        if (databasePromise === sharedPromise) databasePromise = null;
        throw error;
      });

    databasePromise = sharedPromise;
    return sharedPromise;
  };

  return Object.freeze({ get });
}

import { getExpoHoidDatabase } from "./expoHoidDatabase";
import {
  getOrCreateHoidLocalPrincipalIdentity,
  type HoidLocalPrincipalIdentityResult,
  type HoidSecureRandomPort,
} from "./localPrincipalIdentity";
import { createExpoSqliteHoidLocalPrincipalStore } from "./expoSqliteLocalPrincipalStore";

let identityStorePromise: Promise<ReturnType<typeof createExpoSqliteHoidLocalPrincipalStore>> | null = null;

async function getIdentityStore(): Promise<ReturnType<typeof createExpoSqliteHoidLocalPrincipalStore>> {
  if (!identityStorePromise) {
    identityStorePromise = getExpoHoidDatabase()
      .then(database => createExpoSqliteHoidLocalPrincipalStore(database))
      .catch(error => {
        identityStorePromise = null;
        throw error;
      });
  }
  return identityStorePromise;
}

/**
 * Native composition boundary for the installation-local principal.
 * The host must inject a platform CSPRNG. This function is not called by
 * application startup and does not silently create an identity.
 */
export async function getOrCreateExpoHoidLocalPrincipalIdentity(
  randomSource: HoidSecureRandomPort,
): Promise<HoidLocalPrincipalIdentityResult> {
  try {
    const store = await getIdentityStore();
    return getOrCreateHoidLocalPrincipalIdentity(store, randomSource);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

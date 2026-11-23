/**
 * Guards asynchronous import work against stale completions after a newer
 * operation starts or the owning React screen unmounts.
 *
 * The guard carries no source URI, file bytes or reader progress. It is a
 * small lifecycle primitive that can be tested independently of React Native.
 */
export interface HoidImportLifecycleGuard {
  activate(): number;
  beginOperation(): number;
  /** Checks the owning screen lease without requiring the latest operation token. */
  isActive(lease: unknown): lease is number;
  isCurrent(token: unknown): token is number;
  invalidate(): number;
  deactivate(lease: number): void;
}

export function createHoidImportLifecycleGuard(): HoidImportLifecycleGuard {
  let mounted = false;
  let generation = 0;
  let activeLease: number | null = null;

  return Object.freeze({
    activate(): number {
      generation += 1;
      mounted = true;
      activeLease = generation;
      return generation;
    },

    beginOperation(): number {
      generation += 1;
      return generation;
    },

    isActive(lease: unknown): lease is number {
      return mounted && activeLease !== null &&
        typeof lease === "number" && lease === activeLease;
    },

    isCurrent(token: unknown): token is number {
      return mounted && activeLease !== null &&
        typeof token === "number" && token === generation;
    },

    invalidate(): number {
      generation += 1;
      return generation;
    },

    deactivate(lease: number): void {
      if (activeLease !== lease) return;
      mounted = false;
      activeLease = null;
      generation += 1;
    },
  });
}

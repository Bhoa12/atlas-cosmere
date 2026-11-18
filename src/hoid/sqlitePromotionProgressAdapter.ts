import type { HoidPromotionProgressPort } from "./promotionReviewAuthority";

/**
 * Creates a fresh-read adapter over the SQLite cursor store.
 *
 * HoidCursorProgressStore.read() reloads and validates the persisted v2
 * snapshot on every call; this deliberately avoids the coordinator's UI-facing
 * in-memory cache during protected promotion checks.
 */
export function createHoidSqlitePromotionProgressPort(
  storeInput: unknown,
): HoidPromotionProgressPort {
  return Object.freeze({
    async readAuthoritativeProgressSnapshot(): Promise<unknown> {
      let read: (() => Promise<unknown>) | null = null;
      try {
        if (storeInput === null || typeof storeInput !== "object" || Array.isArray(storeInput)) {
          throw new Error("Invalid SQLite progress store");
        }
        let current: object | null = storeInput;
        for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, "read");
          if (descriptor) {
            if (
              !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
              typeof descriptor.value !== "function"
            ) throw new Error("SQLite progress read method must be a data method");
            read = (descriptor.value as () => Promise<unknown>).bind(storeInput);
            break;
          }
          current = Object.getPrototypeOf(current) as object | null;
        }
      } catch {
        throw new Error("SQLite progress store could not be inspected");
      }
      if (!read) throw new Error("SQLite progress read method is unavailable");

      const snapshot = await read();
      if (snapshot === null || snapshot === undefined) {
        throw new Error("SQLite progress snapshot is unavailable or invalid");
      }
      return snapshot;
    },
  });
}

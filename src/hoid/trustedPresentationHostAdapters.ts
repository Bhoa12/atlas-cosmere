import { validateHoidCursorProgressSnapshot } from "./cursorProgressLedger";
import type { HoidTrustedReadingProgressPort } from "./trustedVerifiedAnswerPresentation";

type NoArgumentMethod = () => unknown;

function resolveNoArgumentMethod(value: unknown, name: string): NoArgumentMethod | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as NoArgumentMethod).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Adapts the host's durable cursor refresh operation to the trusted presenter.
 *
 * The supplied refresh operation must reload the authoritative local store
 * (Atlas currently uses HoidCursorProgressCoordinator.refresh over SQLite).
 * A cached React snapshot, provider snapshot, request argument or caller cursor
 * is not an acceptable implementation.
 */
export function createHoidRefreshableTrustedReadingProgressPort(
  refreshPortInput: unknown,
): HoidTrustedReadingProgressPort | null {
  const refresh = resolveNoArgumentMethod(refreshPortInput, "refresh");
  if (!refresh) return null;

  return Object.freeze({
    async readProgressSnapshot(): Promise<unknown> {
      let refreshed: unknown;
      try {
        refreshed = await Promise.resolve(refresh());
      } catch {
        throw new Error("Authoritative Hoid progress refresh failed");
      }

      const validation = validateHoidCursorProgressSnapshot(refreshed);
      if (validation.status !== "valid") {
        throw new Error("Authoritative Hoid progress snapshot is unavailable or invalid");
      }
      return validation.snapshot;
    },
  });
}

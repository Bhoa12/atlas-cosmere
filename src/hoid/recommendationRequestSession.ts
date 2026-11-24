export type HoidRecommendationRequestTicket = Readonly<{
  signal: AbortSignal;
}>;

type ActiveRequest = Readonly<{
  ticket: HoidRecommendationRequestTicket;
  controller: AbortController;
  epoch: number;
}>;

export type HoidRecommendationRequestSession = Readonly<{
  /** Acquires the single request slot; returns null instead of duplicating active work. */
  begin(): HoidRecommendationRequestTicket | null;
  /** True only while the exact ticket still owns the request slot. */
  isCurrent(ticket: unknown): ticket is HoidRecommendationRequestTicket;
  /** Invalidates the current request and aborts its local signal. */
  invalidate(): void;
  /** Releases the slot only for its current owner. */
  finish(ticket: unknown): boolean;
  /** Reports whether a request currently owns the slot. */
  isActive(): boolean;
}>;

/**
 * Serializes the screen's catalogue and topic recommendation requests.
 *
 * The ticket is an in-memory identity capability. A duplicate tap cannot
 * dispatch a second request while the slot is occupied. Progress changes,
 * selection changes, trust-port changes and unmount invalidate the owner.
 * Callers must check isCurrent(ticket) after every await and before each UI
 * commit. The signal is exposed for future cooperative adapter cancellation;
 * this coordinator alone guarantees stale-result suppression, not physical
 * cancellation inside a non-cooperative gateway.
 */
export function createHoidRecommendationRequestSession(): HoidRecommendationRequestSession {
  let epoch = 0;
  let active: ActiveRequest | null = null;

  const advanceEpoch = (): void => {
    epoch = epoch >= Number.MAX_SAFE_INTEGER ? 0 : epoch + 1;
  };

  const invalidate = (): void => {
    advanceEpoch();
    const previous = active;
    active = null;
    previous?.controller.abort();
  };

  return Object.freeze({
    begin(): HoidRecommendationRequestTicket | null {
      if (active !== null && active.epoch === epoch) return null;
      advanceEpoch();
      const controller = new AbortController();
      const ticket = Object.freeze({ signal: controller.signal });
      active = Object.freeze({ ticket, controller, epoch });
      return ticket;
    },

    isCurrent(ticket: unknown): ticket is HoidRecommendationRequestTicket {
      return ticket !== null &&
        typeof ticket === "object" &&
        active !== null &&
        active.epoch === epoch &&
        active.ticket === ticket;
    },

    invalidate,

    finish(ticket: unknown): boolean {
      if (
        ticket === null ||
        typeof ticket !== "object" ||
        active === null ||
        active.epoch !== epoch ||
        active.ticket !== ticket
      ) return false;
      active = null;
      return true;
    },

    isActive(): boolean {
      return active !== null && active.epoch === epoch;
    },
  });
}

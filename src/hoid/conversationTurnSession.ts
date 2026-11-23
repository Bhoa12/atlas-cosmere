export type HoidConversationTurnTicket = Readonly<{
  signal: AbortSignal;
}>;

type ActiveTurn = Readonly<{
  ticket: HoidConversationTurnTicket;
  controller: AbortController;
  epoch: number;
}>;

export type HoidConversationTurnSession = Readonly<{
  /** Starts a turn and supersedes any older in-flight turn. */
  begin(): HoidConversationTurnTicket;
  /** True only for the exact ticket currently owned by this session. */
  isCurrent(ticket: unknown): ticket is HoidConversationTurnTicket;
  /** Aborts current work without invalidating its ticket, allowing a cancellation notice to commit. */
  cancelCurrent(): boolean;
  /** Invalidates the current turn and aborts it. Late completions become inert. */
  invalidate(): void;
  /** Releases the current turn only when the supplied ticket still owns it. */
  finish(ticket: unknown): boolean;
}>;

/**
 * Coordinates one UI conversation turn at a time.
 *
 * The ticket is an identity capability, not a serializable request ID. A reset,
 * progress change, unmount, or newer turn invalidates that identity. Callers
 * must check isCurrent(ticket) after every await before mutating UI or context.
 */
export function createHoidConversationTurnSession(): HoidConversationTurnSession {
  let epoch = 0;
  let active: ActiveTurn | null = null;

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
    begin(): HoidConversationTurnTicket {
      invalidate();
      const controller = new AbortController();
      const ticket = Object.freeze({ signal: controller.signal });
      active = Object.freeze({ ticket, controller, epoch });
      return ticket;
    },

    isCurrent(ticket: unknown): ticket is HoidConversationTurnTicket {
      return ticket !== null &&
        typeof ticket === "object" &&
        active !== null &&
        active.epoch === epoch &&
        active.ticket === ticket;
    },

    cancelCurrent(): boolean {
      if (!active) return false;
      active.controller.abort();
      return true;
    },

    invalidate,

    finish(ticket: unknown): boolean {
      if (ticket === null || typeof ticket !== "object" || !active ||
          active.epoch !== epoch || active.ticket !== ticket) return false;
      active = null;
      return true;
    },
  });
}

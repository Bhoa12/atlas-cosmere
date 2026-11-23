import { describe, expect, it } from "vitest";
import { createHoidConversationTurnSession } from "./conversationTurnSession";

describe("Hoid conversation turn session", () => {
  it("aborts and supersedes an older turn when a newer turn begins", () => {
    const session = createHoidConversationTurnSession();
    const first = session.begin();
    const second = session.begin();

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(session.isCurrent(first)).toBe(false);
    expect(session.isCurrent(second)).toBe(true);
  });

  it("does not let an older finally block release a newer turn", () => {
    const session = createHoidConversationTurnSession();
    const first = session.begin();
    const second = session.begin();

    expect(session.finish(first)).toBe(false);
    expect(session.isCurrent(second)).toBe(true);
    expect(session.finish(second)).toBe(true);
    expect(session.isCurrent(second)).toBe(false);
  });

  it("invalidates and aborts a pending turn on reset or progress change", () => {
    const session = createHoidConversationTurnSession();
    const ticket = session.begin();

    session.invalidate();

    expect(ticket.signal.aborted).toBe(true);
    expect(session.isCurrent(ticket)).toBe(false);
    expect(session.finish(ticket)).toBe(false);
  });

  it("keeps a manually cancelled ticket current so a neutral cancellation notice can commit", () => {
    const session = createHoidConversationTurnSession();
    const ticket = session.begin();

    expect(session.cancelCurrent()).toBe(true);
    expect(ticket.signal.aborted).toBe(true);
    expect(session.isCurrent(ticket)).toBe(true);
    expect(session.finish(ticket)).toBe(true);
  });

  it("rejects forged tickets and safely handles an idle session", () => {
    const session = createHoidConversationTurnSession();
    const ticket = session.begin();

    expect(session.isCurrent({ signal: ticket.signal })).toBe(false);
    expect(session.finish({ signal: ticket.signal })).toBe(false);
    session.invalidate();
    expect(session.cancelCurrent()).toBe(false);
  });
});

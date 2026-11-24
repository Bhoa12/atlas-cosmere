import { describe, expect, it } from "vitest";
import { createHoidRecommendationRequestSession } from "./recommendationRequestSession";

describe("Hoid recommendation request session", () => {
  it("rejects duplicate dispatch while a request owns the slot", () => {
    const session = createHoidRecommendationRequestSession();
    const first = session.begin();

    expect(first).not.toBeNull();
    expect(session.begin()).toBeNull();
    expect(session.isActive()).toBe(true);
    expect(session.isCurrent(first)).toBe(true);
  });

  it("aborts and invalidates pending work when progress or selection changes", () => {
    const session = createHoidRecommendationRequestSession();
    const ticket = session.begin();
    if (!ticket) throw new Error("Expected a request ticket");

    session.invalidate();

    expect(ticket.signal.aborted).toBe(true);
    expect(session.isCurrent(ticket)).toBe(false);
    expect(session.isActive()).toBe(false);
  });

  it("allows a fresh request after invalidation", () => {
    const session = createHoidRecommendationRequestSession();
    const previous = session.begin();
    session.invalidate();
    const current = session.begin();

    expect(previous?.signal.aborted).toBe(true);
    expect(current).not.toBeNull();
    expect(session.isCurrent(current)).toBe(true);
  });

  it("does not let a stale finally block release a later request", () => {
    const session = createHoidRecommendationRequestSession();
    const previous = session.begin();
    session.invalidate();
    const current = session.begin();

    expect(session.finish(previous)).toBe(false);
    expect(session.isCurrent(current)).toBe(true);
    expect(session.finish(current)).toBe(true);
    expect(session.isActive()).toBe(false);
  });

  it("accepts only the exact ticket identity", () => {
    const session = createHoidRecommendationRequestSession();
    const ticket = session.begin();
    if (!ticket) throw new Error("Expected a request ticket");

    expect(session.isCurrent({ signal: ticket.signal })).toBe(false);
    expect(session.finish({ signal: ticket.signal })).toBe(false);
    expect(session.isCurrent(ticket)).toBe(true);
  });

  it("cancels the active request and releases the slot for a new request", () => {
    const session = createHoidRecommendationRequestSession();
    const previous = session.begin();
    if (!previous) throw new Error("Expected a request ticket");

    expect(session.cancelCurrent()).toBe(true);
    expect(previous.signal.aborted).toBe(true);
    expect(session.isCurrent(previous)).toBe(false);
    expect(session.isActive()).toBe(false);
    expect(session.cancelCurrent()).toBe(false);

    const next = session.begin();
    expect(next).not.toBeNull();
    expect(session.isCurrent(next)).toBe(true);
  });

  it("handles invalidation and finish safely while idle", () => {
    const session = createHoidRecommendationRequestSession();

    expect(session.isActive()).toBe(false);
    expect(session.finish(null)).toBe(false);
    expect(() => session.invalidate()).not.toThrow();
    expect(session.begin()).not.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { createHoidImportLifecycleGuard } from "./epubImportLifecycle";

describe("Hoid EPUB import lifecycle guard", () => {
  it("does not accept operations before the screen is active", () => {
    const guard = createHoidImportLifecycleGuard();
    const token = guard.beginOperation();
    expect(guard.isCurrent(token)).toBe(false);
  });

  it("accepts the latest operation while its screen lease is active", () => {
    const guard = createHoidImportLifecycleGuard();
    guard.activate();
    const token = guard.beginOperation();
    expect(guard.isCurrent(token)).toBe(true);
  });

  it("keeps the screen lease active while operation generations advance", () => {
    const guard = createHoidImportLifecycleGuard();
    const lease = guard.activate();
    expect(guard.isActive(lease)).toBe(true);

    const first = guard.beginOperation();
    const second = guard.beginOperation();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
    expect(guard.isActive(lease)).toBe(true);

    guard.deactivate(lease);
    expect(guard.isActive(lease)).toBe(false);
    expect(guard.isCurrent(second)).toBe(false);
  });

  it("invalidates an earlier asynchronous completion when a newer operation starts", () => {
    const guard = createHoidImportLifecycleGuard();
    guard.activate();
    const first = guard.beginOperation();
    const second = guard.beginOperation();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it("invalidates outstanding operations when the screen unmounts", () => {
    const guard = createHoidImportLifecycleGuard();
    const lease = guard.activate();
    const token = guard.beginOperation();
    guard.deactivate(lease);
    expect(guard.isCurrent(token)).toBe(false);
  });

  it("does not let a stale cleanup deactivate a later screen lease", () => {
    const guard = createHoidImportLifecycleGuard();
    const firstLease = guard.activate();
    guard.deactivate(firstLease);
    const secondLease = guard.activate();
    const token = guard.beginOperation();
    guard.deactivate(firstLease);
    expect(guard.isCurrent(token)).toBe(true);
    guard.deactivate(secondLease);
    expect(guard.isCurrent(token)).toBe(false);
  });

  it("can reactivate after a development Strict Mode setup-cleanup cycle", () => {
    const guard = createHoidImportLifecycleGuard();
    const firstLease = guard.activate();
    const stale = guard.beginOperation();
    guard.deactivate(firstLease);
    const secondLease = guard.activate();
    const current = guard.beginOperation();
    expect(guard.isCurrent(stale)).toBe(false);
    expect(guard.isCurrent(current)).toBe(true);
    guard.deactivate(secondLease);
  });

  it("invalidates work explicitly without deactivating the screen", () => {
    const guard = createHoidImportLifecycleGuard();
    const lease = guard.activate();
    const token = guard.beginOperation();
    guard.invalidate();
    expect(guard.isCurrent(token)).toBe(false);
    const next = guard.beginOperation();
    expect(guard.isCurrent(next)).toBe(true);
    guard.deactivate(lease);
  });
});

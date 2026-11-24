import { describe, expect, it } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import {
  emptyHoidUnitProgressSnapshot, validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot, type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  createHoidTrustedConversationGatewayV3,
  type HoidConversationAnswerSinkV3,
  type HoidConversationProgressInvalidationPortV3,
  type HoidTrustedConversationHostPortV3,
} from "./trustedConversationGatewayV3";
import type { HoidExactEvidenceAnswer } from "./exactUnitEvidenceRuntime";
import type {
  HoidPreparedExactUnitAnswer, HoidTrustedAnswerBlockReason,
  HoidTrustedAnswerPrepareResult, HoidTrustedAnswerPresentationResult,
  HoidTrustedPresentationPermit, HoidTrustedScreenAnswerPort,
} from "./trustedExactUnitAnswerHost";

const fixedNow = () => "2026-11-24T21:00:00.000Z";
function reference(bookId: string, chapterNumber: number) {
  const result = createHoidChapterReference(bookId, { chapterNumber });
  if (result.status !== "ready") throw new Error("Synthetic reference unavailable");
  return result.reference;
}
function snapshot(bookId: string, chapterNumber: number, revision: number): HoidUnitProgressSnapshot {
  const cursor = createHoidUnitProgressCursor(bookId, { chapterNumber });
  if (cursor.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return Object.freeze({ schemaVersion: 3, revision,
    positions: Object.freeze([Object.freeze({ bookId, cursor: cursor.cursor })]), updatedAt: fixedNow() });
}
class MemoryStore implements HoidUnitProgressStore {
  value: unknown = emptyHoidUnitProgressSnapshot();
  async read(): Promise<unknown> { return this.value; }
  async compareAndSwap(expected: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    const current = validateHoidUnitProgressSnapshot(this.value);
    const candidate = validateHoidUnitProgressSnapshot(next);
    if (current.status !== "valid" || candidate.status !== "valid" || current.snapshot.revision !== expected) return false;
    this.value = candidate.snapshot;
    return true;
  }
}
class ProgressEvents implements HoidConversationProgressInvalidationPortV3 {
  private listeners = new Set<() => void>();
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(): void { for (const listener of [...this.listeners]) listener(); }
}
function answer(entityIds: readonly string[] = ["evidence.alpha"]): HoidExactEvidenceAnswer {
  const source = reference("twok", 2);
  const firstSafeAppearance = reference("twok", 2);
  const unlock = reference("warbreaker", 2);
  const citation = Object.freeze({ evidenceId: "evidence.alpha", source, firstSafeAppearance, unlock });
  return Object.freeze({
    text: "Afirmación editorial sintética autorizada.",
    claimIds: Object.freeze(["claim.alpha"]),
    evidenceIds: Object.freeze(["evidence.alpha"]),
    entityIds: Object.freeze([...entityIds]),
    sources: Object.freeze([citation]),
    segments: Object.freeze([Object.freeze({ claimId: "claim.alpha", text: "Afirmación editorial sintética autorizada.",
      evidenceIds: Object.freeze(["evidence.alpha"]), sources: Object.freeze([citation]) })]),
    layout: "plain",
  });
}
class FakeHost implements HoidTrustedConversationHostPortV3 {
  requests: unknown[] = [];
  active = new Set<HoidTrustedScreenAnswerPort>();
  private pending = new Map<HoidPreparedExactUnitAnswer, HoidExactEvidenceAnswer>();
  nextAnswers: HoidExactEvidenceAnswer[] = [];
  prepareDelay: ((signal?: AbortSignal) => Promise<void>) | null = null;
  async prepare(request: unknown, options?: { signal?: AbortSignal }): Promise<HoidTrustedAnswerPrepareResult> {
    this.requests.push(request);
    if (this.prepareDelay) await this.prepareDelay(options?.signal);
    if (options?.signal?.aborted) return Object.freeze({ status: "blocked", reason: "answer-unavailable" });
    const prepared = Object.freeze({ kind: "hoid-prepared-exact-unit-answer" as const, registryRevision: 3, progressRevision: 1 });
    this.pending.set(prepared, this.nextAnswers.shift() ?? answer());
    return Object.freeze({ status: "prepared", prepared });
  }
  cancel(prepared: HoidPreparedExactUnitAnswer): void { this.pending.delete(prepared); }
  async present(prepared: HoidPreparedExactUnitAnswer, sink: HoidTrustedScreenAnswerPort): Promise<HoidTrustedAnswerPresentationResult> {
    const value = this.pending.get(prepared); this.pending.delete(prepared);
    if (!value) return Object.freeze({ status: "blocked", reason: "invalid-prepared-answer" });
    const permit: HoidTrustedPresentationPermit = Object.freeze({
      registryRevision: 3, registryFingerprint: "a".repeat(64), progressRevision: 1, progressFingerprint: "b".repeat(64),
    });
    try { sink.present(value, permit); this.active.add(sink); return Object.freeze({ status: "presented", registryRevision: 3, progressRevision: 1 }); }
    catch { sink.clear("presentation-sink-failed"); return Object.freeze({ status: "blocked", reason: "presentation-sink-failed" }); }
  }
  clearSink(sink: HoidTrustedScreenAnswerPort, reason: HoidTrustedAnswerBlockReason = "invalid-prepared-answer"): void {
    if (!this.active.delete(sink)) return;
    sink.clear(reason);
  }
}
function harness() {
  const store = new MemoryStore(); store.value = snapshot("twok", 4, 1);
  const coordinator = new HoidUnitProgressCoordinator(store, fixedNow);
  const events = new ProgressEvents(); const host = new FakeHost();
  const messages = new Map<string, HoidExactEvidenceAnswer>();
  const cleared = new Map<string, HoidTrustedAnswerBlockReason>();
  const sink: HoidConversationAnswerSinkV3 = {
    present(id, value) { messages.set(id, value); },
    clear(id, reason) { messages.delete(id); cleared.set(id, reason); },
  };
  const gateway = createHoidTrustedConversationGatewayV3({ host, coordinator, progressInvalidation: events });
  if (!gateway) throw new Error("Gateway fixture unavailable");
  const session = gateway.createSession("session-1", sink);
  if (!session) throw new Error("Session fixture unavailable");
  return { store, coordinator, events, host, messages, cleared, session };
}

describe("Hoid trusted conversation gateway v3", () => {
  it("carries only approved claim/entity/work IDs across a follow-up", async () => {
    const h = harness();
    expect((await h.session.send({ question: "¿Quién es Entidad Alfa?", intent: "explain", depth: "detailed" })).status).toBe("presented");
    expect((await h.session.send({ question: "¿Y qué relación tiene con ella?", intent: "explain" })).status).toBe("presented");
    expect(h.messages.size).toBe(2);
    const request = h.host.requests[1] as Record<string, unknown>;
    expect(request.entityIds).toEqual(["evidence.alpha"]);
    expect(request.bookScope).toEqual({ mode: "cross-work", bookIds: ["twok", "warbreaker"] });
    expect(request.conversationContext).toEqual({
      schemaVersion: 1, priorClaimIds: ["claim.alpha"], entityIds: ["evidence.alpha"], bookIds: ["twok", "warbreaker"],
    });
    const egress = JSON.stringify(request);
    for (const forbidden of ["progressRevision", "progressFingerprint", "identityFingerprint", "unitId", "Afirmación editorial sintética autorizada"]) {
      expect(egress).not.toContain(forbidden);
    }
    expect(h.session.getContextSnapshot()?.readingPositions[0]).toMatchObject({
      bookId: "twok", status: "reading", chapterNumber: 4,
    });
    h.session.dispose();
  });

  it("asks for clarification rather than guessing between multiple prior entities", async () => {
    const h = harness(); h.host.nextAnswers.push(answer(["evidence.alpha", "evidence.beta"]));
    expect((await h.session.send({ question: "Explica la relación entre estos personajes.", intent: "explain" })).status).toBe("presented");
    expect(await h.session.send({ question: "¿Y qué decidió ella?", intent: "explain" }))
      .toEqual({ status: "needs-clarification", reason: "ambiguous-entity" });
    expect(h.host.requests).toHaveLength(1); h.session.dispose();
  });

  it("retracts every message and clears context when durable progress changes", async () => {
    const h = harness();
    expect((await h.session.send({ question: "Explica Entidad Alfa.", intent: "explain" })).status).toBe("presented");
    h.store.value = snapshot("twok", 5, 2); await h.coordinator.refresh();
    expect(h.messages.size).toBe(0);
    expect([...h.cleared.values()]).toContain("progress-changed");
    expect(h.session.getContextSnapshot()).toBeNull();
    expect(await h.session.send({ question: "¿Y ella?", intent: "explain" }))
      .toEqual({ status: "needs-clarification", reason: "missing-follow-up-context" });
    expect(h.host.requests).toHaveLength(1); h.session.dispose();
  });

  it("does not inherit a prior book scope when the reader explicitly changes entity", async () => {
    const h = harness();
    await h.session.send({ question: "Explica Entidad Alfa.", intent: "explain" });
    expect((await h.session.send({ question: "Ahora explícame otra entidad.", intent: "explain", entityIds: ["evidence.beta"] })).status).toBe("presented");
    const request = h.host.requests[1] as Record<string, unknown>;
    expect(request.entityIds).toEqual(["evidence.beta"]);
    expect(request.bookScope).toBeUndefined();
    expect(request.conversationContext).toBeUndefined(); h.session.dispose();
  });

  it("rejects accessor-backed requests without invoking getters", async () => {
    const h = harness(); let invoked = false;
    const hostile = Object.defineProperty({}, "question", { enumerable: true, get() { invoked = true; return "x"; } });
    expect(await h.session.send(hostile)).toEqual({ status: "blocked", reason: "invalid-request" });
    expect(invoked).toBe(false); expect(h.host.requests).toHaveLength(0); h.session.dispose();
  });

  it("aborts an older in-flight turn when a newer turn arrives", async () => {
    const h = harness(); let releaseFirst: (() => void) | undefined; let markStarted: (() => void) | undefined;
    let calls = 0; let observedAbort = false;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    h.host.prepareDelay = async signal => {
      calls += 1; if (calls > 1) return; markStarted?.();
      await new Promise<void>(resolve => { releaseFirst = resolve; signal?.addEventListener("abort", () => resolve(), { once: true }); });
      observedAbort = signal?.aborted ?? false;
    };
    const firstPromise = h.session.send({ question: "Primera pregunta.", intent: "explain" });
    await started;
    const secondPromise = h.session.send({ question: "Segunda pregunta.", intent: "explain" });
    releaseFirst?.();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.status).toBe("cancelled"); expect(second.status).toBe("presented"); expect(observedAbort).toBe(true);
    h.session.dispose();
  });
});

import { describe, expect, it, vi } from "vitest";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { HoidPipeline } from "./pipeline";
import { HoidService } from "./HoidService";
import type { HoidAliasDisclosurePort, HoidAliasDisclosureRequest } from "./aliasDisclosureBoundary";
import type { HoidProvider } from "./types";

const FINGERPRINT = "b".repeat(64);
const knowledge: HoidKnowledgeEntry[] = [{
  id: "synthetic.legacy-alias",
  aliases: ["Nombre protegido", "Alias posterior"],
  kind: "character",
  firstSafeAppearance: { bookId: "tfe", chapter: 1 },
}];
const reading = [{ bookId: "tfe", chapter: 2 }];

function allowEveryMatchedAlias(): HoidAliasDisclosurePort {
  return {
    authorize(request: HoidAliasDisclosureRequest) {
      return {
        status: "authorized",
        authorizedMatches: request.matches.map(match => ({ id: match.id, aliases: [...match.aliases] })),
        progressRevision: 11,
        progressFingerprint: FINGERPRINT,
      };
    },
  };
}

function makeProvider(answer: string): HoidProvider {
  return { answer: vi.fn(async () => answer) };
}

describe("legacy Hoid provider routes require progress-bound per-alias authorization", () => {
  it("blocks HoidService before provider invocation when a known alias has no authority", async () => {
    const provider = makeProvider("Respuesta que no debe mostrarse");
    const result = await new HoidService(provider, undefined, new HoidKnowledgeCatalog(knowledge)).answer({
      question: "¿Qué significa Nombre protegido?", reading,
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("reading-position");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("allows HoidService only when the host grants the exact matched alias", async () => {
    const provider = makeProvider("Respuesta general sin nombres");
    const result = await new HoidService(provider, undefined, new HoidKnowledgeCatalog(knowledge), allowEveryMatchedAlias()).answer({
      question: "¿Qué significa Nombre protegido?", reading,
    });
    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });

  it("blocks output that introduces an alias without its own grant", async () => {
    const provider = makeProvider("La respuesta menciona Alias posterior.");
    const result = await new HoidService(provider, undefined, new HoidKnowledgeCatalog(knowledge)).answer({
      question: "Pregunta general sin nombres", reading,
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });

  it("rechecks provider output instead of reusing the question grant", async () => {
    const provider = makeProvider("La respuesta menciona Alias posterior.");
    let calls = 0;
    const port: HoidAliasDisclosurePort = {
      authorize(request) {
        calls += 1;
        if (calls === 1) return {
          status: "authorized",
          authorizedMatches: request.matches.map(match => ({ id: match.id, aliases: [...match.aliases] })),
          progressRevision: 11,
          progressFingerprint: FINGERPRINT,
        };
        return { status: "blocked" };
      },
    };
    const result = await new HoidService(provider, undefined, new HoidKnowledgeCatalog(knowledge), port).answer({
      question: "Pregunta sobre Nombre protegido", reading,
    });
    expect(provider.answer).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });

  it("blocks output when the durable progress revision changes mid-request", async () => {
    const provider = makeProvider("Respuesta general sin nombres");
    let revision = 11;
    const port: HoidAliasDisclosurePort = {
      authorize(request) {
        const current = revision;
        return {
          status: "authorized",
          authorizedMatches: request.matches.map(match => ({ id: match.id, aliases: [...match.aliases] })),
          progressRevision: current,
          progressFingerprint: current === 11 ? FINGERPRINT : "c".repeat(64),
        };
      },
    };
    const pending = new HoidService(provider, undefined, new HoidKnowledgeCatalog(knowledge), port).answer({
      question: "Pregunta general sin nombres", reading,
    });
    await Promise.resolve();
    revision = 12;
    const result = await pending;
    expect(provider.answer).toHaveBeenCalledTimes(1);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });

  it("blocks HoidPipeline before provider invocation when a known alias has no authority", async () => {
    const provider = makeProvider("Respuesta que no debe mostrarse");
    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "¿Qué significa Nombre protegido?", reading,
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("reading-position");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("allows HoidPipeline when the host grants every matched alias", async () => {
    const provider = makeProvider("Respuesta general sin nombres");
    const result = await new HoidPipeline(provider, knowledge, 15_000, allowEveryMatchedAlias()).answer({
      question: "¿Qué significa Nombre protegido?", reading,
    });
    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });

  it("blocks HoidPipeline output that introduces an ungranted alias", async () => {
    const provider = makeProvider("La respuesta menciona Alias posterior.");
    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "Pregunta general sin nombres", reading,
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });

  it("keeps alias-free text available without a disclosure port", async () => {
    const provider = makeProvider("Respuesta sin nombres del catálogo");
    const result = await new HoidPipeline(provider, []).answer({
      question: "Pregunta general", reading: [],
    });
    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });
});

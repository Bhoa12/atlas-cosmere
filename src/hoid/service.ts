import { HoidProvider, HoidAnswerRequest } from "./types";
import { HoidKnowledgeEntry } from "./catalog";
import { HoidPipeline } from "./pipeline";
import type { HoidAliasDisclosurePort } from "./aliasDisclosureBoundary";

/**
 * Public application facade for Hoid IA.
 *
 * All requests flow through HoidPipeline so callers cannot accidentally bypass
 * reading authorization, per-alias disclosure and provider-output checks.
 */
export class HoidService {
  private readonly pipeline: HoidPipeline;

  constructor(
    provider: HoidProvider | null | undefined,
    knowledge: HoidKnowledgeEntry[],
    aliasDisclosurePort?: HoidAliasDisclosurePort,
  ) {
    this.pipeline = new HoidPipeline(provider, knowledge, 15_000, aliasDisclosurePort);
  }

  async ask(request: HoidAnswerRequest) {
    return this.pipeline.answer(request);
  }
}

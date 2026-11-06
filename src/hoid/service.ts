import { HoidProvider, HoidAnswerRequest } from "./types";
import { HoidKnowledgeEntry } from "./catalog";
import { HoidPipeline } from "./pipeline";

/**
 * Public application facade for Hoid IA.
 *
 * All requests flow through HoidPipeline so callers cannot accidentally bypass
 * reading authorization or the provider-output spoiler boundary.
 */
export class HoidService {
  private readonly pipeline: HoidPipeline;

  constructor(
    provider: HoidProvider | null | undefined,
    knowledge: HoidKnowledgeEntry[],
  ) {
    this.pipeline = new HoidPipeline(provider, knowledge);
  }

  async ask(request: HoidAnswerRequest) {
    return this.pipeline.answer(request);
  }
}

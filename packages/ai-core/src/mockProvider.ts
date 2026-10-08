import type { AIProvider, AIRequest, AIResponse, AIUsage } from "./types.ts";

/** Deterministic provider for tests and eval runs. Costs nothing (TESTING.md §7: mock mode). */

export interface MockProviderOptions {
  readonly text?: string;
  readonly usage?: AIUsage;
  /** When set, `complete` throws — used to test the fallback path. */
  readonly failWith?: Error;
}

export class MockAIProvider implements AIProvider {
  readonly id = "mock";
  readonly calls: AIRequest[] = [];
  // Explicit field (not a parameter property): Node runs package sources in
  // strip-only TypeScript mode, which rejects parameter properties.
  private readonly opts: MockProviderOptions;

  constructor(opts: MockProviderOptions = {}) {
    this.opts = opts;
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    this.calls.push(req);
    if (this.opts.failWith) throw this.opts.failWith;
    return {
      text: this.opts.text ?? "Mock mentor reply.",
      usage: this.opts.usage ?? { inputTokens: 10, outputTokens: 20 },
    };
  }
}

import type {
  ExtractionInput,
  ExtractionOutcome,
  SuiteSummaryInput,
  SuiteSummaryOutcome,
  TestCaseExtractor,
} from './extraction.contracts';

export class FakeExtractor implements TestCaseExtractor {
  private readonly queue: ExtractionOutcome[] = [];
  private readonly suiteSummaryQueue: SuiteSummaryOutcome[] = [];
  readonly calls: ExtractionInput[] = [];
  readonly suiteSummaryCalls: SuiteSummaryInput[] = [];

  enqueue(outcome: ExtractionOutcome): this {
    this.queue.push(outcome);
    return this;
  }

  enqueueSuiteSummary(outcome: SuiteSummaryOutcome): this {
    this.suiteSummaryQueue.push(outcome);
    return this;
  }

  extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    this.calls.push(input);
    const next = this.queue.shift();
    return Promise.resolve(next ?? { kind: 'no-tests-found' });
  }

  summarizeSuite(input: SuiteSummaryInput): Promise<SuiteSummaryOutcome> {
    this.suiteSummaryCalls.push(input);
    const next = this.suiteSummaryQueue.shift();
    return Promise.resolve(
      next ?? {
        kind: 'provider-unavailable',
        reason: 'not-configured',
        retryable: false,
      },
    );
  }
}

import type {
  ExtractionInput,
  ExtractionOutcome,
  TestCaseExtractor,
} from './extraction.contracts';

export class FakeExtractor implements TestCaseExtractor {
  private readonly queue: ExtractionOutcome[] = [];
  readonly calls: ExtractionInput[] = [];

  enqueue(outcome: ExtractionOutcome): this {
    this.queue.push(outcome);
    return this;
  }

  extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    this.calls.push(input);
    const next = this.queue.shift();
    return Promise.resolve(next ?? { kind: 'no-tests-found' });
  }
}

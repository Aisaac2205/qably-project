import { Injectable } from '@nestjs/common';
import type {
  ExtractionOutcome,
  TestCaseExtractor,
} from './extraction.contracts';

@Injectable()
export class DisabledExtractor implements TestCaseExtractor {
  extract(): Promise<ExtractionOutcome> {
    return Promise.resolve({
      kind: 'provider-unavailable',
      reason: 'GEMINI_API_KEY not configured',
    });
  }
}

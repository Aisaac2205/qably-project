import { INGESTION_QUEUE_DEFAULT_JOB_OPTIONS } from './ingestion.tokens';

describe('INGESTION_QUEUE_DEFAULT_JOB_OPTIONS', () => {
  it('retries three times with an exponential backoff starting at five seconds', () => {
    expect(INGESTION_QUEUE_DEFAULT_JOB_OPTIONS.attempts).toBe(3);
    expect(INGESTION_QUEUE_DEFAULT_JOB_OPTIONS.backoff).toEqual({
      type: 'exponential',
      delay: 5_000,
    });
  });

  it('bounds completed and failed job retention', () => {
    expect(INGESTION_QUEUE_DEFAULT_JOB_OPTIONS.removeOnComplete).toBe(100);
    expect(INGESTION_QUEUE_DEFAULT_JOB_OPTIONS.removeOnFail).toBe(500);
  });
});

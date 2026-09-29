import { describeResponseDiagnostics } from './gemini-response-diagnostics';

const LIMIT = 8192;

describe('describeResponseDiagnostics', () => {
  it('reports the finish reason, output tokens against the limit and prompt tokens', () => {
    const description = describeResponseDiagnostics(
      {
        candidates: [{ finishReason: 'MAX_TOKENS' }],
        usageMetadata: { promptTokenCount: 34841, candidatesTokenCount: 8177 },
      },
      LIMIT,
    );

    expect(description).toBe(
      'finishReason=MAX_TOKENS, output tokens 8177 of 8192, prompt tokens 34841',
    );
  });

  it('reads the finish reason from the first candidate only', () => {
    const description = describeResponseDiagnostics(
      {
        candidates: [{ finishReason: 'STOP' }, { finishReason: 'MAX_TOKENS' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      },
      LIMIT,
    );

    expect(description).toContain('finishReason=STOP,');
  });

  it('says unknown for every field the response does not carry', () => {
    expect(describeResponseDiagnostics({}, LIMIT)).toBe(
      'finishReason=unknown, output tokens unknown of 8192, prompt tokens unknown',
    );
  });

  it('says unknown when the candidates list is empty or the candidate has no finish reason', () => {
    expect(describeResponseDiagnostics({ candidates: [] }, LIMIT)).toContain(
      'finishReason=unknown',
    );
    expect(describeResponseDiagnostics({ candidates: [{}] }, LIMIT)).toContain(
      'finishReason=unknown',
    );
  });

  it('keeps a zero token count instead of treating it as missing', () => {
    const description = describeResponseDiagnostics(
      {
        candidates: [{ finishReason: 'SAFETY' }],
        usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
      },
      LIMIT,
    );

    expect(description).toBe(
      'finishReason=SAFETY, output tokens 0 of 8192, prompt tokens 0',
    );
  });

  it('reports a partially populated usage block field by field', () => {
    const description = describeResponseDiagnostics(
      {
        candidates: [{ finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 500 },
      },
      LIMIT,
    );

    expect(description).toBe(
      'finishReason=STOP, output tokens unknown of 8192, prompt tokens 500',
    );
  });
});

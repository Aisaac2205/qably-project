import { SourceReader, type SourceReadInput } from './source-reader';

const DEFAULT_CAP = 60_000;

function baseInput(overrides: Partial<SourceReadInput> = {}): SourceReadInput {
  return {
    provider: 'GITHUB',
    owner: 'qably',
    repo: 'qably',
    ref: 'abc123',
    path: 'src/cart.spec.ts',
    ...overrides,
  };
}

function readerServing(body: string): SourceReader {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
  });

  return new SourceReader(fetchImpl);
}

describe('SourceReader.read — maximum content length', () => {
  it('cuts at 60,000 characters when the caller passes no limit', async () => {
    const result = await readerServing('a'.repeat(DEFAULT_CAP + 1)).read(
      baseInput(),
    );

    expect(result).toEqual({
      kind: 'content',
      content: 'a'.repeat(DEFAULT_CAP),
      truncated: true,
    });
  });

  it('does not flag a file of exactly 60,000 characters as truncated by default', async () => {
    const result = await readerServing('a'.repeat(DEFAULT_CAP)).read(
      baseInput(),
    );

    expect(result).toEqual({
      kind: 'content',
      content: 'a'.repeat(DEFAULT_CAP),
      truncated: false,
    });
  });

  it('reads a file well past 60,000 characters whole when the limit allows it', async () => {
    const body = 'a'.repeat(120_482);

    const result = await readerServing(body).read(
      baseInput({ maxContentLength: 1_000_000 }),
    );

    expect(result).toEqual({
      kind: 'content',
      content: body,
      truncated: false,
    });
  });

  it('cuts at the passed limit and flags the result as truncated', async () => {
    const result = await readerServing('a'.repeat(1_000_001)).read(
      baseInput({ maxContentLength: 1_000_000 }),
    );

    expect(result.kind).toBe('content');
    if (result.kind !== 'content') return;
    expect(result.content).toHaveLength(1_000_000);
    expect(result.truncated).toBe(true);
  });

  it('honors a limit smaller than the default', async () => {
    const result = await readerServing('abcdefghij').read(
      baseInput({ maxContentLength: 4 }),
    );

    expect(result).toEqual({
      kind: 'content',
      content: 'abcd',
      truncated: true,
    });
  });

  it('applies the limit to Bitbucket sources as well', async () => {
    const result = await readerServing('abcdefghij').read(
      baseInput({ provider: 'BITBUCKET', maxContentLength: 4 }),
    );

    expect(result).toEqual({
      kind: 'content',
      content: 'abcd',
      truncated: true,
    });
  });
});

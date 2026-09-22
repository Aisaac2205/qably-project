import { documentFilesBodySchema } from './review.schemas';

describe('documentFilesBodySchema', () => {
  it('defaults to undocumented mode when the body is omitted', () => {
    expect(documentFilesBodySchema.parse(undefined)).toEqual({
      mode: 'undocumented',
    });
  });

  it('accepts stale-locale mode', () => {
    expect(documentFilesBodySchema.parse({ mode: 'stale-locale' })).toEqual({
      mode: 'stale-locale',
    });
  });

  it('accepts incomplete mode', () => {
    expect(documentFilesBodySchema.parse({ mode: 'incomplete' })).toEqual({
      mode: 'incomplete',
    });
  });

  it('rejects an unrecognized mode', () => {
    expect(() => documentFilesBodySchema.parse({ mode: 'bogus' })).toThrow();
  });
});

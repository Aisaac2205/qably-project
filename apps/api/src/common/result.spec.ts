import { err, isErr, isOk, ok, unwrapOr, type Result } from './result';

type StoreError =
  | { code: 'not_found' }
  | { code: 'invalid_transition'; from: string };

describe('Result', () => {
  it('builds a success carrying its value', () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('builds a failure carrying its error', () => {
    const result = err({ code: 'not_found' as const });

    expect(result).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('narrows to the value branch through isOk', () => {
    const result: Result<number, StoreError> = ok(7);

    if (!isOk(result)) throw new Error('expected ok');

    expect(result.value + 1).toBe(8);
  });

  it('narrows to the error branch through isErr', () => {
    const result: Result<number, StoreError> = err({
      code: 'invalid_transition',
      from: 'draft',
    });

    if (!isErr(result)) throw new Error('expected err');
    if (result.error.code !== 'invalid_transition')
      throw new Error('expected transition error');

    expect(result.error.from).toBe('draft');
  });

  it('returns the value from unwrapOr on success', () => {
    expect(unwrapOr(ok('published'), 'fallback')).toBe('published');
  });

  it('returns the fallback from unwrapOr on failure', () => {
    expect(unwrapOr(err({ code: 'not_found' as const }), 'fallback')).toBe(
      'fallback',
    );
  });
});

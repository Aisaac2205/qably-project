import { isUniqueViolation } from './is-unique-violation';

describe('isUniqueViolation', () => {
  it('recognizes a Prisma P2002 error', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
  });

  it('rejects an unrelated Prisma error code', () => {
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
  });

  it('rejects a plain Error with no code', () => {
    expect(isUniqueViolation(new Error('connection lost'))).toBe(false);
  });

  it('rejects null and primitive values', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('P2002')).toBe(false);
  });
});

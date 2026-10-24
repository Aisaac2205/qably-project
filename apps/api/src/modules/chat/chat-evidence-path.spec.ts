import { isSafeEvidencePath } from './chat-evidence-path';
import { suggestedCaseSchema } from './chat.contracts';

const suggested = {
  title: 'Rejects an expired card',
  objective: 'Confirm expired cards are refused',
  preconditions: [],
  steps: ['Open checkout'],
  expectedResult: 'The payment is refused',
  priority: 'high',
};

describe('isSafeEvidencePath', () => {
  it.each(['tests/checkout.spec.ts', 'e2e/flows/login.spec.ts', 'app.test.js'])(
    'accepts the repository-relative path %s',
    (path) => {
      expect(isSafeEvidencePath(path)).toBe(true);
    },
  );

  it.each([
    '../secrets.ts',
    'tests/../../etc/passwd',
    './tests/checkout.spec.ts',
    '/etc/passwd',
    'C:/repo/tests/checkout.spec.ts',
    'C:\\repo\\tests\\checkout.spec.ts',
    'https://evil.test/checkout.spec.ts',
    'file:/etc/passwd',
    'tests//checkout.spec.ts',
    '',
  ])('rejects the untrusted path %j', (path) => {
    expect(isSafeEvidencePath(path)).toBe(false);
  });
});

describe('suggestedCaseSchema evidencePath', () => {
  it('keeps a safe repository-relative evidence path', () => {
    const parsed = suggestedCaseSchema.parse({
      ...suggested,
      evidencePath: ' tests/checkout.spec.ts ',
    });

    expect(parsed.evidencePath).toBe('tests/checkout.spec.ts');
  });

  it.each(['../secrets.ts', '/etc/passwd', 'https://evil.test/a.spec.ts'])(
    'drops the unsafe evidence path %j but keeps the case',
    (evidencePath) => {
      const result = suggestedCaseSchema.safeParse({
        ...suggested,
        evidencePath,
      });

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe(suggested.title);
      expect(result.data?.evidencePath).toBeUndefined();
    },
  );

  it('leaves the evidence path out when the model gives none', () => {
    const parsed = suggestedCaseSchema.parse(suggested);

    expect(parsed.evidencePath).toBeUndefined();
  });
});

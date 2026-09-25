import { sendMessageSchema } from './chat.schemas';

const CUID = 'ckv8f9q7z0000qzrmn831i7rn';
const CUID_2 = 'ckv8f9q7z0001qzrmn831i7rn';
const CUID_3 = 'ckv8f9q7z0002qzrmn831i7rn';
const CUID_4 = 'ckv8f9q7z0003qzrmn831i7rn';
const CUID_5 = 'ckv8f9q7z0004qzrmn831i7rn';
const CUID_6 = 'ckv8f9q7z0005qzrmn831i7rn';

describe('sendMessageSchema.caseIds', () => {
  it('accepts a message with no caseIds', () => {
    const result = sendMessageSchema.safeParse({ content: 'hello' });

    expect(result.success).toBe(true);
  });

  it('accepts up to 5 case ids', () => {
    const result = sendMessageSchema.safeParse({
      content: 'improve this',
      caseIds: [CUID, CUID_2, CUID_3, CUID_4, CUID_5],
    });

    expect(result.success).toBe(true);
  });

  it('rejects more than 5 case ids', () => {
    const result = sendMessageSchema.safeParse({
      content: 'improve this',
      caseIds: [CUID, CUID_2, CUID_3, CUID_4, CUID_5, CUID_6],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate case ids', () => {
    const result = sendMessageSchema.safeParse({
      content: 'improve this',
      caseIds: [CUID, CUID],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a case id that is not cuid-like', () => {
    const result = sendMessageSchema.safeParse({
      content: 'improve this',
      caseIds: ['not-a-cuid'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty caseIds array as pointless input', () => {
    const result = sendMessageSchema.safeParse({
      content: 'improve this',
      caseIds: [],
    });

    expect(result.success).toBe(false);
  });
});

describe('sendMessageSchema.filePath', () => {
  it('accepts a message with no filePath', () => {
    const result = sendMessageSchema.safeParse({ content: 'hello' });

    expect(result.success).toBe(true);
  });

  it('accepts and preserves a safe repo-relative filePath', () => {
    const result = sendMessageSchema.safeParse({
      content: 'hello',
      filePath: 'src/checkout.spec.ts',
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.filePath).toBe('src/checkout.spec.ts');
  });

  it('rejects a path traversal attempt', () => {
    const result = sendMessageSchema.safeParse({
      content: 'hello',
      filePath: '../../etc/passwd',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an absolute path', () => {
    const result = sendMessageSchema.safeParse({
      content: 'hello',
      filePath: '/etc/passwd',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a backslash path', () => {
    const result = sendMessageSchema.safeParse({
      content: 'hello',
      filePath: 'src\\checkout.spec.ts',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty filePath', () => {
    const result = sendMessageSchema.safeParse({
      content: 'hello',
      filePath: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a filePath over 300 characters', () => {
    const result = sendMessageSchema.safeParse({
      content: 'hello',
      filePath: `${'a'.repeat(298)}.ts`,
    });

    expect(result.success).toBe(false);
  });
});

import { decodeInboxCursor, encodeInboxCursor } from './inbox-cursor';

describe('inbox cursor', () => {
  it('round-trips createdAt and id through base64url', () => {
    const encoded = encodeInboxCursor({
      createdAt: '2026-09-24T10:00:00.000Z',
      id: 'proposal-1',
    });

    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(decodeInboxCursor(encoded)).toEqual({
      createdAt: '2026-09-24T10:00:00.000Z',
      id: 'proposal-1',
    });
  });

  it('refuses a cursor that is not valid base64url JSON', () => {
    expect(decodeInboxCursor('not-a-cursor')).toBeNull();
  });

  it('refuses a cursor missing the id half of the pair', () => {
    const encoded = Buffer.from(
      JSON.stringify(['2026-09-24T10:00:00.000Z']),
      'utf8',
    ).toString('base64url');

    expect(decodeInboxCursor(encoded)).toBeNull();
  });

  it('refuses a cursor whose createdAt is not a valid date', () => {
    const encoded = Buffer.from(
      JSON.stringify(['not-a-date', 'proposal-1']),
      'utf8',
    ).toString('base64url');

    expect(decodeInboxCursor(encoded)).toBeNull();
  });
});

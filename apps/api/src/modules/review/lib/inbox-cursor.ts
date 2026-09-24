export interface InboxCursor {
  createdAt: string;
  id: string;
}

export function encodeInboxCursor(cursor: InboxCursor): string {
  const json = JSON.stringify([cursor.createdAt, cursor.id]);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeInboxCursor(raw: string): InboxCursor | null {
  let json: string;
  try {
    json = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) return null;
  const [createdAt, id] = parsed as [unknown, unknown];
  if (typeof createdAt !== 'string' || typeof id !== 'string') return null;
  if (id.length === 0) return null;
  if (Number.isNaN(new Date(createdAt).getTime())) return null;

  return { createdAt, id };
}

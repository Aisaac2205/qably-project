import type { SuiteSortKey } from '@qably/types';

const CURSOR_VERSION = 1;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_PASS_RATE = 100;

function toTuple(key: SuiteSortKey): unknown[] {
  switch (key.sort) {
    case 'recent':
      return [CURSOR_VERSION, key.sort, key.createdAt, key.id];
    case 'name':
      return [CURSOR_VERSION, key.sort, key.name, key.id];
    case 'pass-rate':
      return [
        CURSOR_VERSION,
        key.sort,
        key.recentPassRate,
        key.createdAt,
        key.id,
      ];
    case 'cases':
      return [CURSOR_VERSION, key.sort, key.caseCount, key.createdAt, key.id];
  }
}

export function encodeSuiteSummariesCursor(key: SuiteSortKey): string {
  const json = JSON.stringify(toTuple(key));

  return Buffer.from(json, 'utf8').toString('base64url');
}

function parseTuple(raw: string): unknown[] | null {
  if (!BASE64URL_PATTERN.test(raw)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );

    return Array.isArray(parsed) ? (parsed as unknown[]) : null;
  } catch {
    return null;
  }
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isPassRate(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= MAX_PASS_RATE)
  );
}

function isCaseCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function decodeRecent(fields: unknown[]): SuiteSortKey | null {
  const [createdAt, id] = fields;

  if (fields.length !== 2 || !isTimestamp(createdAt) || !isIdentifier(id)) {
    return null;
  }

  return { sort: 'recent', createdAt, id };
}

function decodeName(fields: unknown[]): SuiteSortKey | null {
  const [name, id] = fields;

  if (fields.length !== 2 || typeof name !== 'string' || !isIdentifier(id)) {
    return null;
  }

  return { sort: 'name', name, id };
}

function decodePassRate(fields: unknown[]): SuiteSortKey | null {
  const [recentPassRate, createdAt, id] = fields;

  if (
    fields.length !== 3 ||
    !isPassRate(recentPassRate) ||
    !isTimestamp(createdAt) ||
    !isIdentifier(id)
  ) {
    return null;
  }

  return { sort: 'pass-rate', recentPassRate, createdAt, id };
}

function decodeCases(fields: unknown[]): SuiteSortKey | null {
  const [caseCount, createdAt, id] = fields;

  if (
    fields.length !== 3 ||
    !isCaseCount(caseCount) ||
    !isTimestamp(createdAt) ||
    !isIdentifier(id)
  ) {
    return null;
  }

  return { sort: 'cases', caseCount, createdAt, id };
}

export function decodeSuiteSummariesCursor(raw: string): SuiteSortKey | null {
  const tuple = parseTuple(raw);

  if (tuple === null) {
    return null;
  }

  const [version, sort, ...fields] = tuple;

  if (version !== CURSOR_VERSION) {
    return null;
  }

  switch (sort) {
    case 'recent':
      return decodeRecent(fields);
    case 'name':
      return decodeName(fields);
    case 'pass-rate':
      return decodePassRate(fields);
    case 'cases':
      return decodeCases(fields);
    default:
      return null;
  }
}

import { isUniqueViolation } from './is-unique-violation';

export interface UniqueViolationTarget {
  readonly fields: readonly string[] | null;
  readonly constraint: string | null;
}

const CONSTRAINT_IN_MESSAGE = /unique constraint "([^"]+)"/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function unquote(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).replace(/""/g, '"')
    : trimmed;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string')
    ? value.map(unquote)
    : null;
}

function adapterCause(meta: Record<string, unknown> | null) {
  return asRecord(asRecord(meta?.driverAdapterError)?.cause);
}

function fieldsFrom(meta: Record<string, unknown> | null): string[] | null {
  const constraint = asRecord(adapterCause(meta)?.constraint);
  return stringArray(constraint?.fields) ?? stringArray(meta?.target);
}

function constraintFrom(meta: Record<string, unknown> | null): string | null {
  const cause = adapterCause(meta);
  const index = asRecord(cause?.constraint)?.index;
  if (typeof index === 'string') return index;

  const message = cause?.originalMessage;
  if (typeof message === 'string') {
    const match = CONSTRAINT_IN_MESSAGE.exec(message);
    if (match !== null) return match[1];
  }

  return typeof meta?.target === 'string' ? meta.target : null;
}

export function uniqueViolationTarget(
  error: unknown,
): UniqueViolationTarget | null {
  if (!isUniqueViolation(error)) return null;

  const meta = asRecord((error as { meta?: unknown }).meta);

  return { fields: fieldsFrom(meta), constraint: constraintFrom(meta) };
}

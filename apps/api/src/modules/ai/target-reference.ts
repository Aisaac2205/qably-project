import { sanitizeUntrustedText } from '../../common/prompt/untrusted-text';

export type TargetTag = `T${number}`;

export interface TargetManifestEntry<T> {
  readonly tag: TargetTag;
  readonly target: T;
}

// Composite automationKey ingestion cap (250-char classname + "::" + 120-char
// name, see extraction.contracts.ts) — never truncate a real key below this.
const AUTOMATION_KEY_MAX_LENGTH = 372;
const TARGET_TAG_PATTERN = /^T([1-9]\d*)(?=$|[\s:])/i;

export function targetTagAt(index: number): TargetTag {
  return `T${index + 1}`;
}

export function parseTargetRef(raw: unknown): TargetTag | undefined {
  if (typeof raw !== 'string') return undefined;

  const match = TARGET_TAG_PATTERN.exec(raw.trim());
  if (match === null) return undefined;

  return `T${match[1]}` as TargetTag;
}

export function renderTargetLines(keys: readonly string[]): string[] {
  return keys.map(
    (key, index) =>
      `${targetTagAt(index)}: ${sanitizeUntrustedText(key, AUTOMATION_KEY_MAX_LENGTH)}`,
  );
}

export function buildTargetManifest<
  T extends { readonly testCaseId: string; readonly automationKey: string },
>(targets: readonly T[]): ReadonlyMap<TargetTag, TargetManifestEntry<T>> {
  const sorted = [...targets].sort((a, b) =>
    a.testCaseId.localeCompare(b.testCaseId),
  );

  return new Map(
    sorted.map((target, index) => {
      const tag = targetTagAt(index);
      return [tag, { tag, target }];
    }),
  );
}

export type TargetTag = `T${number}`;

export interface TargetManifestEntry<T> {
  readonly tag: TargetTag;
  readonly target: T;
}

const TARGET_TAG_PATTERN = /^T([1-9]\d*)(?!\d)/i;
const CRLF_RUN = /(?:\r\n|\r|\n)+/g;

export function targetTagAt(index: number): TargetTag {
  return `T${index + 1}`;
}

export function parseTargetRef(raw: unknown): TargetTag | undefined {
  if (typeof raw !== 'string') return undefined;

  const match = TARGET_TAG_PATTERN.exec(raw.trim());
  if (match === null) return undefined;

  return `T${Number(match[1])}`;
}

export function renderTargetLines(keys: readonly string[]): string[] {
  return keys.map(
    (key, index) => `${targetTagAt(index)}: ${key.replace(CRLF_RUN, ' ')}`,
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

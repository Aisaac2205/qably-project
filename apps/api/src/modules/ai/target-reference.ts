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

export function renderTargetLines<T extends { readonly automationKey: string }>(
  manifest: ReadonlyMap<TargetTag, TargetManifestEntry<T>>,
): string[] {
  return [...manifest.values()].map(
    (entry) =>
      `${entry.tag}: ${sanitizeUntrustedText(entry.target.automationKey, AUTOMATION_KEY_MAX_LENGTH)}`,
  );
}

export interface TargetManifest<T> {
  readonly manifest: ReadonlyMap<TargetTag, TargetManifestEntry<T>>;
  // The same targets, in the exact order the manifest numbered them
  // (testCaseId-ascending). This is the ONLY correct order for anything
  // derived from these targets that must agree with the manifest (e.g. the
  // prompt's target-cases block) — never re-sort independently elsewhere.
  readonly sortedTargets: readonly T[];
}

export function buildTargetManifest<
  T extends { readonly testCaseId: string; readonly automationKey: string },
>(targets: readonly T[]): TargetManifest<T> {
  const sortedTargets = [...targets].sort((a, b) =>
    a.testCaseId.localeCompare(b.testCaseId),
  );

  const manifest = new Map(
    sortedTargets.map((target, index) => {
      const tag = targetTagAt(index);
      return [tag, { tag, target }];
    }),
  );

  return { manifest, sortedTargets };
}

import { isDottedIdentifier, isIdentifier } from '@qably/test-naming';
import type { CaseHealthSignal } from '@qably/types';

export type { CaseHealthSignal } from '@qably/types';

export type CaseHealthResult = 'pass' | 'fail' | 'skip' | 'blocked';

export interface CaseHealthInput {
  id: string;
  suiteId: string;
  projectId: string;
  name: string;
  automationKey: string | null;
  executionMode: 'manual' | 'automated';
  steps: readonly string[];
  recentResults: readonly CaseHealthResult[];
  hasAnyRun: boolean;
}

const FLAKY_ALTERNATION_THRESHOLD = 2;
const GROUP_KEY_SEPARATOR = ':';

function looksLikeRawName(name: string, automationKey: string | null): boolean {
  if (automationKey !== null && name === automationKey) return true;
  if (name.includes(' ')) return false;
  if (!isIdentifier(name) && !isDottedIdentifier(name)) return false;

  const hasUnderscore = name.includes('_');
  const hasMixedCase = /\p{Ll}/u.test(name) && /\p{Lu}/u.test(name);
  return hasUnderscore || hasMixedCase;
}

function isFlaky(recentResults: readonly CaseHealthResult[]): boolean {
  const passOrFail = recentResults.filter(
    (result): result is 'pass' | 'fail' =>
      result === 'pass' || result === 'fail',
  );

  let alternations = 0;
  for (let index = 1; index < passOrFail.length; index += 1) {
    if (passOrFail[index] !== passOrFail[index - 1]) alternations += 1;
  }

  return alternations >= FLAKY_ALTERNATION_THRESHOLD;
}

function normalizeTitle(title: string): string {
  return title
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function computeSingleCaseSignals(input: CaseHealthInput): CaseHealthSignal[] {
  const signals: CaseHealthSignal[] = [];

  if (input.executionMode === 'automated' && input.steps.length === 0) {
    signals.push('no-steps');
  }

  if (looksLikeRawName(input.name, input.automationKey)) {
    signals.push('raw-name');
  }

  if (input.executionMode === 'automated' && !input.hasAnyRun) {
    signals.push('never-run');
  }

  if (isFlaky(input.recentResults)) {
    signals.push('flaky');
  }

  return signals;
}

function groupBy<T>(
  items: readonly T[],
  key: (item: T) => string | null,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const groupKey = key(item);
    if (groupKey === null) continue;

    const group = groups.get(groupKey);
    if (group === undefined) {
      groups.set(groupKey, [item]);
    } else {
      group.push(item);
    }
  }

  return groups;
}

function duplicateKeyGroupKey(input: CaseHealthInput): string | null {
  if (input.automationKey === null) return null;
  return input.projectId.concat(GROUP_KEY_SEPARATOR, input.automationKey);
}

function nearDuplicateTitleGroupKey(input: CaseHealthInput): string | null {
  const normalized = normalizeTitle(input.name);
  if (normalized.length === 0) return null;
  return input.suiteId.concat(GROUP_KEY_SEPARATOR, normalized);
}

export function deriveCaseHealth(
  cases: readonly CaseHealthInput[],
): ReadonlyMap<string, readonly CaseHealthSignal[]> {
  const signalsById = new Map<string, CaseHealthSignal[]>();
  for (const input of cases) {
    signalsById.set(input.id, computeSingleCaseSignals(input));
  }

  const duplicateKeyGroups = groupBy(cases, duplicateKeyGroupKey);
  for (const group of duplicateKeyGroups.values()) {
    if (group.length < 2) continue;
    for (const input of group) {
      signalsById.get(input.id)?.push('duplicate-key');
    }
  }

  const titleGroups = groupBy(cases, nearDuplicateTitleGroupKey);
  for (const group of titleGroups.values()) {
    if (group.length < 2) continue;
    for (const input of group) {
      signalsById.get(input.id)?.push('near-duplicate-title');
    }
  }

  return signalsById;
}

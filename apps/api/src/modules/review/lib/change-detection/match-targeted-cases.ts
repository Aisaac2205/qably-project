import { parseTargetRef, targetTagAt } from '../../../ai/target-reference';
import { normalizeAutomationKey } from '../normalize-automation-key';
import type { SnapshotDeclaration } from './declaration-snapshot';

export interface TargetedCase {
  readonly automationKey: string;
  readonly targetRef?: string;
  readonly sourceExcerpt: string;
}

export interface TargetedMatch<C extends TargetedCase> {
  /** Each case with the target it describes, in target order. */
  readonly matched: readonly {
    readonly target: SnapshotDeclaration;
    readonly testCase: C;
  }[];
  /** Targets no case describes. */
  readonly missing: readonly SnapshotDeclaration[];
  /** Cases that describe no target: an unchanged test, or an invented one. */
  readonly dropped: number;
}

// Shorter excerpt lines (`});`, `expect(x)`) occur all over a test file and
// cannot point at one declaration.
const MIN_EXCERPT_LINE_LENGTH = 8;

function nameChain(target: SnapshotDeclaration): string {
  return normalizeAutomationKey(
    [...target.describePath, target.title].join(' '),
  );
}

/**
 * The key names the target when it is its describe chain and title (jest:
 * joined by spaces; vitest: by " > ", after the file path and "::").
 */
function keyNames(automationKey: string, target: SnapshotDeclaration): boolean {
  const key = normalizeAutomationKey(automationKey);
  const chain = nameChain(target);
  return key === chain || key.endsWith(`::${chain}`);
}

/** The targets whose line span holds the excerpt's most distinctive line. */
function targetsQuoted(
  excerpt: string,
  targets: readonly SnapshotDeclaration[],
  contentLines: readonly string[],
): SnapshotDeclaration[] {
  const quoted = excerpt
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= MIN_EXCERPT_LINE_LENGTH)
    .sort((a, b) => b.length - a.length)[0];
  if (quoted === undefined) return [];

  const lines = contentLines.flatMap((line, index) =>
    line.includes(quoted) ? [index + 1] : [],
  );

  return targets.filter((target) =>
    lines.some((line) => line >= target.startLine && line <= target.endLine),
  );
}

/**
 * Maps the cases a targeted extraction returned back to the declarations it
 * asked for, tagged `T1`, `T2`, ... by position. Each case is tried in turn:
 *
 * 1. the tag it cites in `targetRef`, when no other case cites the same tag
 *    for a plain test (a table, `.each`/`.for`, takes one case per row);
 * 2. its automation key, when it is exactly one target's describe chain and
 *    title (the case's `title` is the model's own wording, never the code's);
 * 3. its `sourceExcerpt`, when its longest line falls inside exactly one
 *    target's line span in `content`.
 *
 * A plain test takes one case; any further case for it is dropped, like every
 * case that matches no target.
 */
export function matchTargetedCases<C extends TargetedCase>(
  targets: readonly SnapshotDeclaration[],
  cases: readonly C[],
  content: string,
): TargetedMatch<C> {
  const contentLines = content.split(/\r\n|\r|\n/);
  const casesByTarget = new Map<SnapshotDeclaration, C[]>();
  const targetByTag = new Map(
    targets.map((target, index) => [targetTagAt(index), target]),
  );

  const accepts = (target: SnapshotDeclaration): boolean =>
    target.parametrized || !casesByTarget.has(target);
  const bind = (target: SnapshotDeclaration, testCase: C): void => {
    casesByTarget.set(target, [...(casesByTarget.get(target) ?? []), testCase]);
  };

  const citations = new Map<SnapshotDeclaration, C[]>();
  for (const testCase of cases) {
    const tag = parseTargetRef(testCase.targetRef);
    const target = tag === undefined ? undefined : targetByTag.get(tag);
    if (target === undefined) continue;
    citations.set(target, [...(citations.get(target) ?? []), testCase]);
  }

  const bound = new Set<C>();
  for (const [target, citing] of citations) {
    if (!target.parametrized && citing.length !== 1) continue;
    for (const testCase of citing) {
      bind(target, testCase);
      bound.add(testCase);
    }
  }

  let dropped = 0;
  for (const testCase of cases) {
    if (bound.has(testCase)) continue;

    const byKey = targets.filter((target) =>
      keyNames(testCase.automationKey, target),
    );
    const candidates =
      byKey.length === 1
        ? byKey
        : targetsQuoted(testCase.sourceExcerpt, targets, contentLines);

    const [target] = candidates;
    if (candidates.length === 1 && accepts(target)) {
      bind(target, testCase);
      bound.add(testCase);
    } else {
      dropped += 1;
    }
  }

  return {
    matched: targets.flatMap((target) =>
      (casesByTarget.get(target) ?? []).map((testCase) => ({
        target,
        testCase,
      })),
    ),
    missing: targets.filter((target) => !casesByTarget.has(target)),
    dropped,
  };
}

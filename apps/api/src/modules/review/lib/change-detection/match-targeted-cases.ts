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
  /**
   * Cases that describe no target: an unchanged test, an invented one, or one
   * whose tag contradicts what its key or excerpt points at.
   */
  readonly dropped: number;
}

// Shorter excerpt lines (`});`, `expect(x)`) occur all over a test file and
// cannot point at one declaration.
const MIN_EXCERPT_LINE_LENGTH = 8;

function nameChain(declaration: SnapshotDeclaration): string {
  return normalizeAutomationKey(
    [...declaration.describePath, declaration.title].join(' '),
  );
}

/**
 * The key names the declaration when it is its describe chain and title
 * (jest: joined by spaces; vitest: by " > ", after the file path and "::").
 */
function keyNames(
  automationKey: string,
  declaration: SnapshotDeclaration,
): boolean {
  const key = normalizeAutomationKey(automationKey);
  const chain = nameChain(declaration);
  return key === chain || key.endsWith(`::${chain}`);
}

/** The declarations whose line span holds the excerpt's longest line. */
function declarationsQuoted(
  excerpt: string,
  declarations: readonly SnapshotDeclaration[],
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

  return declarations.filter((declaration) =>
    lines.some(
      (line) => line >= declaration.startLine && line <= declaration.endLine,
    ),
  );
}

/**
 * What a case's own content says it describes, among every declaration of the
 * file: the ones its key names and the ones its excerpt quotes. Either list
 * is empty when that evidence points nowhere.
 */
interface Evidence {
  readonly named: readonly SnapshotDeclaration[];
  readonly quoted: readonly SnapshotDeclaration[];
}

/** The declaration agrees with every piece of evidence the case carries. */
function consistentWith(
  evidence: Evidence,
  declaration: SnapshotDeclaration,
): boolean {
  const agrees = (list: readonly SnapshotDeclaration[]) =>
    list.length === 0 || list.some(({ id }) => id === declaration.id);
  return agrees(evidence.named) && agrees(evidence.quoted);
}

/**
 * Maps the cases a targeted extraction returned back to the declarations it
 * asked for, tagged `T1`, `T2`, ... by position. Keys and excerpts are checked
 * against every declaration of the file, not only the targets, so a case that
 * describes a test nobody asked about is recognized as such.
 *
 * 1. A case citing a tag in `targetRef` is bound to that target when its key
 *    and excerpt do not point at another declaration, and no other case cites
 *    the same tag for a plain test (a table, `.each`/`.for`, takes one case
 *    per row). A tag its key or excerpt contradicts drops the case.
 * 2. Any other case is bound when its key and excerpt together point at
 *    exactly one declaration and that declaration is a target. The case's
 *    `title` is the model's own wording, never the code's, so it is not used.
 *
 * A plain test takes one case; any further case for it is dropped, like every
 * case that points at no target.
 */
export function matchTargetedCases<C extends TargetedCase>(
  targets: readonly SnapshotDeclaration[],
  declarations: readonly SnapshotDeclaration[],
  cases: readonly C[],
  content: string,
): TargetedMatch<C> {
  const contentLines = content.split(/\r\n|\r|\n/);
  const targetIds = new Set(targets.map(({ id }) => id));
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const targetByTag = new Map(
    targets.map((target, index) => [targetTagAt(index), target]),
  );
  const casesByTarget = new Map<string, C[]>();

  const accepts = (target: SnapshotDeclaration): boolean =>
    target.parametrized || !casesByTarget.has(target.id);
  const bind = (target: SnapshotDeclaration, testCase: C): void => {
    casesByTarget.set(target.id, [
      ...(casesByTarget.get(target.id) ?? []),
      testCase,
    ]);
  };

  const evidenceOf = new Map<C, Evidence>(
    cases.map((testCase) => [
      testCase,
      {
        named: declarations.filter((declaration) =>
          keyNames(testCase.automationKey, declaration),
        ),
        quoted: declarationsQuoted(
          testCase.sourceExcerpt,
          declarations,
          contentLines,
        ),
      },
    ]),
  );

  const settled = new Set<C>();
  let dropped = 0;

  const citations = new Map<SnapshotDeclaration, C[]>();
  for (const testCase of cases) {
    const tag = parseTargetRef(testCase.targetRef);
    const target = tag === undefined ? undefined : targetByTag.get(tag);
    if (target === undefined) continue;

    if (!consistentWith(evidenceOf.get(testCase) as Evidence, target)) {
      settled.add(testCase);
      dropped += 1;
      continue;
    }
    citations.set(target, [...(citations.get(target) ?? []), testCase]);
  }

  for (const [target, citing] of citations) {
    if (!target.parametrized && citing.length !== 1) continue;
    for (const testCase of citing) {
      bind(target, testCase);
      settled.add(testCase);
    }
  }

  for (const testCase of cases) {
    if (settled.has(testCase)) continue;

    const evidence = evidenceOf.get(testCase) as Evidence;
    const located =
      evidence.named.length === 0 && evidence.quoted.length === 0
        ? []
        : declarations.filter((declaration) =>
            consistentWith(evidence, declaration),
          );
    const target =
      located.length === 1 && targetIds.has(located[0].id)
        ? targetById.get(located[0].id)
        : undefined;

    if (target !== undefined && accepts(target)) {
      bind(target, testCase);
    } else {
      dropped += 1;
    }
  }

  return {
    matched: targets.flatMap((target) =>
      (casesByTarget.get(target.id) ?? []).map((testCase) => ({
        target,
        testCase,
      })),
    ),
    missing: targets.filter((target) => !casesByTarget.has(target.id)),
    dropped,
  };
}

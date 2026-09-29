import type { PrismaService } from '../../prisma/prisma.service';

export const MAX_DIAGNOSED_TITLES = 20;
export const MAX_LISTED_UNMATCHED_KEYS = 10;

export interface IncomingTitle {
  readonly testCaseId: string;
  readonly automationKey: string;
  readonly suiteId: string;
  readonly title: string;
}

export interface DuplicateIncomingTitle {
  readonly suiteId: string;
  readonly title: string;
  readonly automationKeys: readonly string[];
}

export interface NameHolder {
  readonly id: string;
  readonly suiteId: string;
  readonly name: string;
  readonly automationKey: string | null;
}

export interface BlockingHolder {
  readonly suiteId: string;
  readonly title: string;
  readonly holderId: string;
  readonly holderAutomationKey: string | null;
}

export interface MatchedTitle {
  readonly target: {
    readonly testCaseId: string;
    readonly automationKey: string;
  };
  readonly testCase: { readonly title: string };
}

export interface UnmatchedTargetsSummaryInput {
  readonly filePath: string;
  readonly matched: number;
  readonly total: number;
  readonly unmatchedKeys: readonly string[];
  readonly sourceLength: number;
  readonly truncated: boolean;
}

const NONE = 'none';

function nameKey(suiteId: string, title: string): string {
  return JSON.stringify([suiteId, title]);
}

export function findDuplicateIncomingTitles(
  incoming: readonly IncomingTitle[],
): DuplicateIncomingTitle[] {
  const groups = new Map<
    string,
    { suiteId: string; title: string; automationKeys: string[] }
  >();

  for (const entry of incoming) {
    const key = nameKey(entry.suiteId, entry.title);
    const group = groups.get(key);

    if (group === undefined) {
      groups.set(key, {
        suiteId: entry.suiteId,
        title: entry.title,
        automationKeys: [entry.automationKey],
      });
    } else {
      group.automationKeys.push(entry.automationKey);
    }
  }

  return [...groups.values()].filter(
    (group) => group.automationKeys.length > 1,
  );
}

export function findBlockingHolders(
  holders: readonly NameHolder[],
  incoming: readonly IncomingTitle[],
): BlockingHolder[] {
  return holders
    .filter((holder) =>
      incoming.some(
        (entry) =>
          entry.suiteId === holder.suiteId &&
          entry.title === holder.name &&
          entry.testCaseId !== holder.id,
      ),
    )
    .map((holder) => ({
      suiteId: holder.suiteId,
      title: holder.name,
      holderId: holder.id,
      holderAutomationKey: holder.automationKey,
    }));
}

function listOrNone(items: readonly string[]): string {
  return items.length === 0 ? NONE : items.join('; ');
}

export function formatNameCollisionDiagnosis(
  filePath: string,
  duplicates: readonly DuplicateIncomingTitle[],
  holders: readonly BlockingHolder[],
): string {
  const repeated = duplicates.map(
    (group) =>
      `${JSON.stringify(group.title)} in suite ${group.suiteId} (keys ${group.automationKeys.map((key) => JSON.stringify(key)).join(', ')})`,
  );
  const held = holders.map(
    (holder) =>
      `${JSON.stringify(holder.title)} in suite ${holder.suiteId} is held by case ${holder.holderId} (key ${holder.holderAutomationKey === null ? NONE : JSON.stringify(holder.holderAutomationKey)})`,
  );

  return `Persisting the documentation for ${filePath} hit the unique (suiteId, name) constraint. Incoming titles repeated within the job: ${listOrNone(repeated)}. Incoming titles already held by another case: ${listOrNone(held)}.`;
}

export function summarizeUnmatchedTargets(
  input: UnmatchedTargetsSummaryInput,
): string {
  const listed = input.unmatchedKeys
    .slice(0, MAX_LISTED_UNMATCHED_KEYS)
    .map((key) => JSON.stringify(key))
    .join(', ');
  const remaining = input.unmatchedKeys.length - MAX_LISTED_UNMATCHED_KEYS;
  const more = remaining > 0 ? ` (+${remaining} more)` : '';
  const cut = input.truncated ? 'truncated' : 'not truncated';

  return `Matched ${input.matched} of ${input.total} target(s) in ${input.filePath}; ${input.unmatchedKeys.length} unmatched: ${listed}${more}; source length ${input.sourceLength} characters, ${cut}`;
}

export function describeTruncatedSource(
  filePath: string,
  length: number,
): string {
  return `Source for ${filePath} was cut at ${length} characters: cases located after the cut cannot be documented`;
}

function firstDistinctTitles(
  incoming: readonly IncomingTitle[],
): Map<string, Set<string>> {
  const titlesBySuite = new Map<string, Set<string>>();
  let count = 0;

  for (const entry of incoming) {
    const titles = titlesBySuite.get(entry.suiteId) ?? new Set<string>();
    if (titles.has(entry.title)) continue;
    if (count >= MAX_DIAGNOSED_TITLES) break;

    titles.add(entry.title);
    titlesBySuite.set(entry.suiteId, titles);
    count += 1;
  }

  return titlesBySuite;
}

async function findNameHolders(
  prisma: Pick<PrismaService, 'testCase'>,
  incoming: readonly IncomingTitle[],
): Promise<NameHolder[]> {
  const titlesBySuite = firstDistinctTitles(incoming);
  if (titlesBySuite.size === 0) return [];

  return prisma.testCase.findMany({
    where: {
      OR: [...titlesBySuite].map(([suiteId, titles]) => ({
        suiteId,
        name: { in: [...titles] },
      })),
    },
    select: { id: true, suiteId: true, name: true, automationKey: true },
  });
}

export async function diagnoseNameCollision(
  prisma: Pick<PrismaService, 'testCase'>,
  filePath: string,
  matched: readonly MatchedTitle[],
): Promise<string> {
  try {
    const rows = await prisma.testCase.findMany({
      where: { id: { in: matched.map(({ target }) => target.testCaseId) } },
      select: { id: true, suiteId: true },
    });
    const suiteIdByCaseId = new Map(rows.map((row) => [row.id, row.suiteId]));

    const incoming = matched.flatMap(({ target, testCase }) => {
      const suiteId = suiteIdByCaseId.get(target.testCaseId);
      if (suiteId === undefined) return [];

      return [
        {
          testCaseId: target.testCaseId,
          automationKey: target.automationKey,
          suiteId,
          title: testCase.title,
        },
      ];
    });

    const holders = await findNameHolders(prisma, incoming);

    return formatNameCollisionDiagnosis(
      filePath,
      findDuplicateIncomingTitles(incoming),
      findBlockingHolders(holders, incoming),
    );
  } catch {
    return `Persisting the documentation for ${filePath} hit the unique (suiteId, name) constraint, and the diagnosis lookup failed`;
  }
}

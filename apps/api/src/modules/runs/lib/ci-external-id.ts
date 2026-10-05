const GITHUB_RUN_ID_PREFIX = /^gha-(\d+)-/;

interface JobKeyMatch {
  key: string;
  length: number;
  exact: boolean;
}

export function parseCiRunExternalId(
  externalId: string | null | undefined,
): string | undefined {
  if (externalId === null || externalId === undefined) return undefined;
  return GITHUB_RUN_ID_PREFIX.exec(externalId)?.[1];
}

function slugifyJobKey(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'report';
}

function matchesOf(key: string, remainder: string): JobKeyMatch[] {
  const segments = [
    { segment: key, exact: true },
    { segment: slugifyJobKey(key), exact: false },
  ];

  return segments
    .filter(({ segment }) => remainder.startsWith(`${segment}-`))
    .map(({ segment, exact }) => ({ key, length: segment.length, exact }));
}

function rank(left: JobKeyMatch, right: JobKeyMatch): number {
  if (left.length !== right.length) return right.length - left.length;
  return Number(right.exact) - Number(left.exact);
}

export function resolveCiJobKey(
  externalId: string | null | undefined,
  ciRunExternalId: string,
  knownJobKeys: readonly string[],
): string | undefined {
  const prefix = `gha-${ciRunExternalId}-`;
  if (externalId === null || externalId === undefined) return undefined;
  if (!externalId.startsWith(prefix)) return undefined;

  const remainder = externalId.slice(prefix.length);
  const matches = [...new Set(knownJobKeys)]
    .filter((key) => key !== '')
    .flatMap((key) => matchesOf(key, remainder))
    .sort(rank);

  const [best, runnerUp] = matches;
  if (best === undefined) return undefined;
  if (runnerUp !== undefined && rank(best, runnerUp) === 0) return undefined;

  return best.key;
}

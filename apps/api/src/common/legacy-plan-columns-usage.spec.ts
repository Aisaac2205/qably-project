import { readdirSync, readFileSync, statSync, Stats } from 'node:fs';
import { extname, join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.next',
  'generated',
  'coverage',
]);
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx']);

const SCAN_ROOTS = [
  join(REPO_ROOT, 'apps', 'api', 'src'),
  join(REPO_ROOT, 'apps', 'api', 'test'),
  join(REPO_ROOT, 'apps', 'api', 'prisma', 'seed.ts'),
  join(REPO_ROOT, 'apps', 'web', 'src'),
  join(REPO_ROOT, 'packages', 'config', 'src'),
  join(REPO_ROOT, 'packages', 'i18n', 'src'),
  join(REPO_ROOT, 'packages', 'test-naming', 'src'),
  join(REPO_ROOT, 'packages', 'types', 'src'),
  join(REPO_ROOT, 'packages', 'ui', 'src'),
];

const SELF_FILE = __filename;

const BANNED_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'maxProjects', pattern: /\bmaxProjects\b/ },
  { name: 'maxUsers', pattern: /\bmaxUsers\b/ },
  { name: 'maxCases', pattern: /\bmaxCases\b/ },
  { name: 'aiCredits (legacy column)', pattern: /\baiCredits\b/ },
];

const GUIDANCE =
  'The legacy plan-limit columns (maxProjects, maxUsers, maxCases) and the ' +
  'legacy aiCredits balance column were dropped by the plan-tiers-and-members ' +
  'contract migration. Limits now come from PLAN_LIMITS in @qably/types, and ' +
  'credits are tracked via aiCreditsUsed/aiCreditsPeriodStart, not aiCredits.';

function collectFiles(root: string, out: string[] = []): string[] {
  let stats: Stats;
  try {
    stats = statSync(root);
  } catch {
    return out;
  }

  if (stats.isFile()) {
    if (SCANNED_EXTENSIONS.has(extname(root))) out.push(root);
    return out;
  }

  for (const entry of readdirSync(root)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;

    const full = join(root, entry);
    const entryStats = statSync(full);

    if (entryStats.isDirectory()) {
      collectFiles(full, out);
      continue;
    }

    if (!SCANNED_EXTENSIONS.has(extname(entry))) continue;

    out.push(full);
  }

  return out;
}

function findOffenses(file: string): string[] {
  if (file === SELF_FILE) return [];

  const content = readFileSync(file, 'utf8');
  const offenses: string[] = [];

  for (const { name, pattern } of BANNED_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = globalPattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      offenses.push(`${file}:${line}: references "${name}"`);
    }
  }

  return offenses;
}

describe('legacy plan-limit column usage guard', () => {
  it('never references maxProjects, maxUsers, maxCases, or the legacy aiCredits column', () => {
    const files = SCAN_ROOTS.flatMap((root) => collectFiles(root));
    const offenses = files.flatMap(findOffenses);

    expect(offenses.length > 0 ? [GUIDANCE, ...offenses].join('\n') : '').toBe(
      '',
    );
  });
});

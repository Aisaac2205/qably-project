import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const SRC_ROOT = join(__dirname, '..', '..');
const HELPER_BASENAME = 'job-id.ts';
const IGNORED_DIRECTORIES = new Set(['node_modules']);

const TYPE_ANNOTATION = /^string\??\b/;
const CONSTRUCTED_VIA_HELPER = /buildJobId\(/;
const FORWARDS_EXISTING_JOB_ID = /^[^'"`]*\.jobId\b/;

const GUIDANCE =
  'Queue job ids must be built exclusively through buildJobId ' +
  '(apps/api/src/common/queue/job-id.ts). Replace the inline construction ' +
  "below with buildJobId('<kind>', [...components]) instead of a template " +
  'literal, string concatenation, or a bespoke sanitizer — a bare colon in ' +
  'a custom BullMQ job id throws at runtime, and only the shared helper is ' +
  'guaranteed to avoid it.';

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;

    const full = join(dir, entry);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      collectTsFiles(full, out);
      continue;
    }

    if (extname(entry) !== '.ts') continue;
    if (entry.endsWith('.spec.ts') || entry.endsWith('.d.ts')) continue;
    if (entry === HELPER_BASENAME) continue;

    out.push(full);
  }

  return out;
}

function findOffenses(file: string): string[] {
  const content = readFileSync(file, 'utf8');
  const pattern = /\bjobId\b\s*[:=]\s*([\s\S]{0,140})/g;
  const offenses: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const rhs = match[1].trim();

    if (TYPE_ANNOTATION.test(rhs)) continue;
    if (CONSTRUCTED_VIA_HELPER.test(rhs.slice(0, 40))) continue;
    if (FORWARDS_EXISTING_JOB_ID.test(rhs)) continue;

    const line = content.slice(0, match.index).split('\n').length;
    offenses.push(`${file}:${line}: ${match[0].slice(0, 80).trim()}`);
  }

  return offenses;
}

describe('queue job id construction guard', () => {
  it('only constructs BullMQ custom job ids through the shared buildJobId helper', () => {
    const files = collectTsFiles(SRC_ROOT);
    const offenses = files.flatMap(findOffenses);

    expect(offenses.length > 0 ? [GUIDANCE, ...offenses].join('\n') : '').toBe(
      '',
    );
  });
});

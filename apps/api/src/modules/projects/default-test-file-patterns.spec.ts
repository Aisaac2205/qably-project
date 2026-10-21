import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_TEST_FILE_PATTERNS } from '@qably/types';

const PRISMA_DIR = join(__dirname, '..', '..', '..', 'prisma');

function quotedStrings(list: string, quote: string): string[] {
  const matches = list.matchAll(
    new RegExp(`${quote}([^${quote}]*)${quote}`, 'g'),
  );
  return [...matches].map((match) => match[1] ?? '');
}

function schemaDefault(): string[] {
  const schema = readFileSync(join(PRISMA_DIR, 'schema.prisma'), 'utf8');
  const line = schema
    .split('\n')
    .find((candidate) => /^\s*testFilePatterns\s/.test(candidate));
  const list = /@default\(\[(.*)\]\)/.exec(line ?? '')?.[1];

  if (list === undefined) throw new Error('testFilePatterns has no default');
  return quotedStrings(list, '"');
}

/** The default the migrations leave in force: the last one that sets it wins. */
function migrationDefault(): string[] {
  const migrations = readdirSync(join(PRISMA_DIR, 'migrations'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let latest: string[] | undefined;

  for (const migration of migrations) {
    const sql = readFileSync(
      join(PRISMA_DIR, 'migrations', migration, 'migration.sql'),
      'utf8',
    );
    const list = /"testFilePatterns"[^;]*?DEFAULT\s+ARRAY\[([^\]]*)\]/i.exec(
      sql,
    )?.[1];

    if (list !== undefined) latest = quotedStrings(list, "'");
  }

  if (latest === undefined) throw new Error('no migration sets the default');
  return latest;
}

describe('Project.testFilePatterns default', () => {
  it('keeps the Prisma schema in step with the shared constant', () => {
    expect(schemaDefault()).toEqual([...DEFAULT_TEST_FILE_PATTERNS]);
  });

  it('keeps the last migration that sets the column default in step too', () => {
    expect(migrationDefault()).toEqual([...DEFAULT_TEST_FILE_PATTERNS]);
  });

  it('ships the default change as its own migration, leaving existing rows alone', () => {
    const migration = '20261021120000_default_test_patterns_include_tsx';
    const sql = readFileSync(
      join(PRISMA_DIR, 'migrations', migration, 'migration.sql'),
      'utf8',
    );

    expect(sql).toMatch(/ALTER COLUMN "testFilePatterns" SET DEFAULT/);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
  });
});

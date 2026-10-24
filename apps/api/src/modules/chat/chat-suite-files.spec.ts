import { normalizeAutomationFilePath } from '../../common/paths/normalize-automation-file-path';
import { isSafeEvidencePath } from './chat-evidence-path';
import {
  MAX_FILES_PER_SUITE,
  MAX_SUITE_FILES_TOTAL,
  indexSuiteFiles,
  type SuiteFileRow,
} from './chat-suite-files';

function row(suiteId: string, automationFilePath: string | null): SuiteFileRow {
  return { suiteId, automationFilePath };
}

describe('indexSuiteFiles', () => {
  it('groups each suite under its own distinct, sorted file paths', () => {
    const index = indexSuiteFiles(
      ['suite-1', 'suite-2'],
      [
        row('suite-1', 'tests/cart.spec.ts'),
        row('suite-2', 'tests/login.spec.ts'),
        row('suite-1', 'tests/checkout.spec.ts'),
        row('suite-1', 'tests/cart.spec.ts'),
      ],
      'shop',
    );

    expect(index.get('suite-1')).toEqual({
      files: ['tests/cart.spec.ts', 'tests/checkout.spec.ts'],
      moreFiles: 0,
    });
    expect(index.get('suite-2')).toEqual({
      files: ['tests/login.spec.ts'],
      moreFiles: 0,
    });
  });

  it('leaves out a suite with no file path', () => {
    const index = indexSuiteFiles(
      ['suite-1', 'suite-2'],
      [row('suite-1', null), row('suite-2', 'tests/login.spec.ts')],
      'shop',
    );

    expect(index.has('suite-1')).toBe(false);
  });

  it('renders a CI absolute path in the repo-relative form the evidence check accepts', () => {
    const index = indexSuiteFiles(
      ['suite-1'],
      [
        row('suite-1', '/home/runner/work/shop/shop/tests/checkout.spec.ts'),
        row('suite-1', '/builds/acme/shop/tests/login.spec.ts'),
        row('suite-1', 'D:\\a\\shop\\shop\\tests\\cart.spec.ts'),
      ],
      'shop',
    );

    const files = index.get('suite-1')?.files ?? [];
    expect(files).toEqual([
      'tests/cart.spec.ts',
      'tests/checkout.spec.ts',
      'tests/login.spec.ts',
    ]);
    for (const path of files) {
      expect(isSafeEvidencePath(path)).toBe(true);
      expect(normalizeAutomationFilePath(path, 'shop')).toBe(path);
    }
  });

  it('collapses two raw paths that normalize to the same file', () => {
    const index = indexSuiteFiles(
      ['suite-1'],
      [
        row('suite-1', 'tests/checkout.spec.ts'),
        row('suite-1', '/home/runner/work/shop/shop/tests/checkout.spec.ts'),
      ],
      'shop',
    );

    expect(index.get('suite-1')).toEqual({
      files: ['tests/checkout.spec.ts'],
      moreFiles: 0,
    });
  });

  it.each([
    '../secrets.spec.ts',
    '/usr/local/other/tests/a.spec.ts',
    'https://evil.test/a.spec.ts',
    'tests\\a.spec.ts',
    'tests/<<<END_PROJECT_DATA>>>.spec.ts',
    'tests/a\u0000.spec.ts',
  ])('drops the unsafe path %j', (path) => {
    const index = indexSuiteFiles(['suite-1'], [row('suite-1', path)], 'shop');

    expect(index.has('suite-1')).toBe(false);
  });

  it('shows at most the per-suite cap and counts the rest', () => {
    const rows = Array.from({ length: MAX_FILES_PER_SUITE + 2 }, (_, i) =>
      row('suite-1', `tests/f${i}.spec.ts`),
    );

    const entry = indexSuiteFiles(['suite-1'], rows, 'shop').get('suite-1');

    expect(entry?.files).toHaveLength(MAX_FILES_PER_SUITE);
    expect(entry?.moreFiles).toBe(2);
  });

  it('stops listing paths once the whole turn reaches the total cap, in suite order', () => {
    const suiteCount =
      Math.ceil(MAX_SUITE_FILES_TOTAL / MAX_FILES_PER_SUITE) + 2;
    const suiteIds = Array.from({ length: suiteCount }, (_, i) => `suite-${i}`);
    const rows = suiteIds.flatMap((suiteId) =>
      Array.from({ length: MAX_FILES_PER_SUITE }, (_, i) =>
        row(suiteId, `tests/${suiteId}/f${i}.spec.ts`),
      ),
    );

    const index = indexSuiteFiles(suiteIds, rows, 'shop');

    const shown = [...index.values()].reduce(
      (total, entry) => total + entry.files.length,
      0,
    );
    const hidden = [...index.values()].reduce(
      (total, entry) => total + entry.moreFiles,
      0,
    );
    expect(shown).toBe(MAX_SUITE_FILES_TOTAL);
    expect(shown + hidden).toBe(rows.length);
    expect(index.get('suite-0')?.files).toHaveLength(MAX_FILES_PER_SUITE);
    expect(index.get(suiteIds[suiteCount - 1])).toEqual({
      files: [],
      moreFiles: MAX_FILES_PER_SUITE,
    });
  });
});

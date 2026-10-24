import { normalizeAutomationFilePath } from '../../common/paths/normalize-automation-file-path';
import { sanitizeUntrustedText } from '../../common/prompt/untrusted-text';
import { isSafeEvidencePath } from './chat-evidence-path';

export const MAX_FILES_PER_SUITE = 3;
export const MAX_SUITE_FILES_TOTAL = 40;
const MAX_FILE_PATH_LENGTH = 300;

export interface SuiteFileRow {
  suiteId: string;
  automationFilePath: string | null;
}

export interface SuiteFiles {
  files: string[];
  moreFiles: number;
}

/**
 * Turns a raw automation file path into the exact text Aeris may copy into
 * `evidencePath`, or null when that copy would not survive the send-time
 * check. The path is normalized the same way the source reader normalizes it,
 * so a listed path reads the same file it names, and it must already be what
 * the prompt sanitizer would print: a path the sanitizer would alter could not
 * be copied back byte for byte.
 */
function toListedPath(rawPath: string, repoName?: string): string | null {
  const path = normalizeAutomationFilePath(rawPath, repoName);
  if (!isSafeEvidencePath(path)) return null;
  if (sanitizeUntrustedText(path, MAX_FILE_PATH_LENGTH) !== path) return null;
  return path;
}

/**
 * Indexes the distinct, verifiable test file paths of each suite for the chat
 * project context. Suites are filled in the given order: each lists at most
 * {@link MAX_FILES_PER_SUITE} paths, the whole turn at most
 * {@link MAX_SUITE_FILES_TOTAL}, and every path left out is counted in
 * `moreFiles`. A suite with no verifiable path is absent from the map.
 */
export function indexSuiteFiles(
  orderedSuiteIds: readonly string[],
  rows: readonly SuiteFileRow[],
  repoName?: string,
): Map<string, SuiteFiles> {
  const pathsBySuite = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.automationFilePath) continue;
    const path = toListedPath(row.automationFilePath, repoName);
    if (path === null) continue;

    const paths = pathsBySuite.get(row.suiteId) ?? new Set<string>();
    paths.add(path);
    pathsBySuite.set(row.suiteId, paths);
  }

  const index = new Map<string, SuiteFiles>();
  let budget = MAX_SUITE_FILES_TOTAL;
  for (const suiteId of orderedSuiteIds) {
    const paths = pathsBySuite.get(suiteId);
    if (paths === undefined) continue;

    const sorted = [...paths].sort();
    const shown = sorted.slice(0, Math.min(MAX_FILES_PER_SUITE, budget));
    budget -= shown.length;
    index.set(suiteId, {
      files: shown,
      moreFiles: sorted.length - shown.length,
    });
  }

  return index;
}

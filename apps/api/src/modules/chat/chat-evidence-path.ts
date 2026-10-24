import { isSafeRepoRelativePath } from '@qably/types';

/**
 * Guards a file path proposed by the assistant before it reaches the source
 * reader. Model output is untrusted: on top of the shared repository-relative
 * rules (no absolute path, no backslash, no `.`/`..` or empty segment), any
 * colon is refused, which rules out URLs (`https://…`, `file:…`) and drive
 * letters (`C:/…`). Passing this check only makes a path eligible for a read;
 * the evidence gate still decides whether the repository backs it.
 */
export function isSafeEvidencePath(path: string): boolean {
  return isSafeRepoRelativePath(path) && !path.includes(':');
}

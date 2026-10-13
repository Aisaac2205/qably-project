/**
 * Names, for every file a push touched, the last commit of that push that
 * touched it.
 *
 * Commits are ordered by `position`, oldest first, so a later commit overrides
 * an earlier one. The paths come from each commit's `attributedFiles`: the
 * paths a code change may safely be attributed to that commit for, which can be
 * partial or empty (see `NormalizedScmCommit.attributedFiles`). A file that no
 * commit is attributed is simply absent from the result: the caller decides the
 * fallback (the push's tip sha), which is also what covers pushes whose
 * provider omitted the commits, truncated pushes, and events stored before
 * commits carried attributed files.
 *
 * Pure: no I/O, no framework types, and the input is never mutated. Commits
 * that share a position keep the order of the input, the last one winning.
 */

export interface CommitWithAttributedFiles {
  sha: string;
  /** 0-based, oldest first, in the order the provider delivered. */
  position: number;
  attributedFiles: readonly string[];
}

export function lastCommitPerFile(
  commits: readonly CommitWithAttributedFiles[],
): Map<string, string> {
  const lastCommit = new Map<string, string>();

  // Sorting a copy keeps the caller's array untouched; the sort is stable.
  const oldestFirst = [...commits].sort((a, b) => a.position - b.position);

  for (const { sha, attributedFiles } of oldestFirst) {
    for (const path of attributedFiles) lastCommit.set(path, sha);
  }

  return lastCommit;
}

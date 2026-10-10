# Commit attribution

Given the commit of a baseline run and the commit of a later run, Qably can list the commits that were pushed in between. The list is a set of **candidates**: commits that landed between the two runs. It never says which commit changed a result, and nothing downstream should present it as the cause.

The list is rebuilt from the push events the repository connection already recorded (`scm_event` and `scm_commit`). It does not call the Git provider. When the recorded history cannot prove a chain from the baseline to the later run, the answer is `unknown` with a reason, never a best guess.

The logic is one pure function, `computeCommitRange` in `apps/api/src/modules/runs/lib/compute-commit-range.ts`. It has no database or framework dependency: the caller loads the events and passes them in.

## Quick path

```ts
computeCommitRange({
  baseSha, // Run.commitSha of the baseline run
  headSha, // Run.commitSha of the later run
  events, // recorded SCM events of the project, or null without a connection
  maxCommits, // optional, default 100
});
```

It returns one of three results:

| Result | Meaning |
|---|---|
| `{ kind: 'same_commit', sha }` | Both runs report the same commit. There is nothing between them. The `sha` is returned as long as the run reported it (trimmed, lowercase): it is the full 40-character sha only when one side was full. |
| `{ kind: 'range', baseSha, headSha, commits }` | The pushes between the runs, oldest first. The baseline commit is excluded, the later run's commit is included. Both shas are the resolved 40-character shas. |
| `{ kind: 'unknown', reason }` | No chain could be proven. See [Reasons](#reasons). |

Each entry of `commits` carries `sha`, `position`, `message`, `author`, `committedAt`, `url`, plus `eventId` and `branch`: the push it was read from and the branch of that push.

## How the range is found

1. **Normalize the run shas.** Trim and lowercase both. A missing or blank sha is `no_commit_reported`.
2. **Same commit.** Two shas are the same commit when they are equal, or when the shorter one has at least 7 characters, is all hex, and is a prefix of the other. This check runs before the events are looked at, so it works for a project without a connection. The result carries the longer of the two normalized shas; when both are the same 7-character prefix, that short prefix is returned as given.
3. **Connection.** `events === null` means the project has no repository connection: `no_repository_connected`.
4. **Resolve the shas.** Only `PUSH` events that listed at least one commit take part. `PULL_REQUEST` events carry no history and are ignored, and so is a push whose provider reported no commits. A run sha is resolved against every sha those pushes mention: their commits, their tip (`commitSha`) and the tip before them (`beforeSha`). A full sha must match exactly. A short sha (7 or more hex characters) must match the start of exactly one known sha. A head that cannot be resolved is `commit_not_in_history`; so is a sha shorter than 7 characters, not hex, or a prefix shared by two commits.
5. **Walk back from the head.** Starting at the head commit, find the pushes that list it. Inside a push, take every commit from the cursor down to the oldest one listed (this is why a head in the middle of a push leaves out the commits after it). Stop with success as soon as the baseline commit is reached. If the push ends without the baseline:
   - if the push was not truncated and its `beforeSha` is the baseline, stop with success;
   - else if the push was forced, fail (a rewrite);
   - else if the push was truncated, fail (a gap);
   - else if `beforeSha` is empty (new ref or unknown), fail;
   - else continue from `beforeSha`, in the pushes that list it. If none does, fail.
6. **Try every candidate push.** A commit can be listed by several pushes: a feature-branch push and, later, the merge push to the main branch both list the same commits. For each commit the candidate pushes are tried newest first (by `receivedAt`, then by the smaller event id), and the first complete chain wins. A `receivedAt` that cannot be parsed counts as the oldest. A chain never lists the same commit twice. The result does not depend on the order of the input array.
7. **Limit.** A chain with more than `maxCommits` candidates is abandoned. The default is 100, and a non-positive `maxCommits` falls back to it. A range of exactly `maxCommits` commits is accepted.

Because every candidate is tried, the same commit seen on a feature branch and on `main` does not mix branches: the entries of one range come from one chain of pushes.

### Example

Pushes to `main`, oldest first: `P1` lists `a`, `P2` lists `b1 b2` (before `a`), `P3` lists `c1` (before `b2`). Baseline `a`, later run `c1`: the walk reads `c1` from `P3`, follows its `beforeSha` to `b2`, reads `b2 b1` from `P2`, and reaches `a` through `P2.beforeSha`. The range is `b1 b2 c1`.

## Reasons

Some reasons are decided before the walk, in this order: `no_commit_reported`, then `no_repository_connected` (after `same_commit`), then `commit_not_in_history` for a later run's commit that is in no recorded push or is not a usable sha (shorter than 7 characters, not hex, or ambiguous).

When the walk from the later run's commit does not reach the baseline, the reason is chosen in this order. The first row that applies wins.

| Priority | Reason | When |
|---|---|---|
| 1 | `out_of_order` | Walking back from the baseline reaches the later run's commit: the "baseline" is newer than the "later" run. Needs a resolved baseline. |
| 2 | `commit_not_in_history` | The baseline commit is unresolved: in no recorded push, not hex, shorter than 7 characters, or a prefix shared by two commits. A larger `maxCommits` could never make that range computable, so this wins over the next two rows. |
| 3 | `range_too_large` | A chain was found but has more than `maxCommits` candidates. |
| 4 | `history_rewritten` | The chain would cross a forced push, so the recorded parent links cannot be trusted. A push that is both forced and truncated is reported here, because the rewrite is the stronger fact. |
| 5 | `different_branch` | The baseline was recorded only on branches the later run's commit was never recorded on. |
| 6 | `history_gap` | Everything else: an unknown `beforeSha`, a push that created the ref, a truncated push, or a push that reported no commits breaks the chain. |

## Limits

- **Only recorded pushes count.** Pushes made before the connection existed, or whose webhook was never delivered, leave a gap.
- **Runs have no branch.** The branch of a candidate is the branch of the push it was read from. `different_branch` compares the branches of the pushes that mention each commit.
- **A forced push is a boundary.** The chain stops there, unless the baseline is inside that push's own commits. A forced push whose previous tip is exactly the baseline is accepted, unless that push is also truncated.
- **Truncated pushes.** A push can omit commits (the GitHub adapter keeps the most recent 250 of a push). The oldest ones are dropped, so a truncated push is trusted only when the baseline is among its listed commits. A truncated push whose `beforeSha` is the baseline is a `history_gap` (`history_rewritten` when it is also forced), because the dropped commits would be exactly the ones right after the baseline.
- **Rebases and squash merges.** A squash or rebase merge creates new shas on the target branch. The original feature-branch commits are then not part of the main chain.
- **No filtering.** A candidate is any commit in the chain, whether or not it touched the code a test covers.
- **Run shas are not normalized upstream.** `Run.commitSha` may be a full sha, a short sha, mixed case, or null. SCM shas are expected to be lowercase 40-character hex, as the ingestion adapters store them.

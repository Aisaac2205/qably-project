# GitHub Integration — How a Repository Reaches Qably

Qably links a project to a repository without asking anyone to generate or paste a personal access
token. The credential comes from the GitHub sign-in the user already performed.

This guide covers GitHub. Connections also accept the `BITBUCKET` provider; its webhooks are handled
by `apps/api/src/modules/ingestion/adapters/bitbucket.adapter.ts`.

## The flow

1. The user signs in with GitHub. `better-auth` stores the provider access token on the `account`
   row it already owns.
2. `GET /connections/available-repos` reads that token and asks GitHub for the repositories the user
   can reach, across their own account and the organizations they belong to (up to five pages of 100
   repositories).
3. The user picks a repository in the project form. The picker merges two sources into one list,
   ordered by most recent push so the repository someone touched today sits at the top: repositories
   already connected to the organization, and repositories that GitHub offers but Qably has not
   connected yet.
4. Picking an unconnected repository creates the `Connection` first, then creates the project
   pointing at it. Picking an already-connected one links straight to it.

A `Connection` belongs to the organization and owns the webhook secret. A `Project` points at a
`Connection` through a nullable foreign key, so the repository of a project is always **derived**
from its connection and never stored twice.

## What Qably reads from a push

`github.adapter.ts` turns a `push` webhook into one normalized event. From the payload it reads
`ref` (the branch), `repository.full_name`, `repository.default_branch` (trimmed, `null` when
missing or blank), `pusher.name` and `head_commit` (id, message, url and the `added`, `modified` and
`removed` lists). It also reads three fields that describe the whole push, not just its last commit:

- `before`, the commit the ref pointed at before the push. An all-zero value (a newly created ref)
  or anything that is not a 40-character hex sha becomes `null`.
- `forced`, true only when the payload says `forced: true`.
- `commits`, every commit of the push. Each one keeps its sha (lowercase), its position in the
  delivered order, the first line of its message (trimmed, at most 200 characters), its author
  (username, else name, else `unknown`), its timestamp (kept as delivered only if it parses as a
  date, otherwise `null`), its url and its `attributedFiles`, which is **not** the list of files the
  commit touched (see
  [Each code change names the last commit that touched its file](#each-code-change-names-the-last-commit-that-touched-its-file)).
  An entry whose id is not a 40-character hex sha cannot be stored as a commit, but its files still
  count for the changed files below.

GitHub caps `commits` at 2048 entries. Qably keeps at most 250: when a push delivers more, it keeps
the last 250 and numbers them from 0 again. `commitsTruncated` is true whenever the list is not the
whole push, either because Qably cut it or because the delivery reached GitHub's own 2048 limit. The
cap bounds only that list; the changed files below are computed from every delivered commit,
including the ones that cannot be stored.

Ingestion persists the event with `defaultBranch`, `changedFiles`, `beforeSha`, `forced` and
`commitsTruncated` (`scm_event`), and the kept commits in the same write (`scm_commit`).

### Changed files are the net effect of the push

Until now only `head_commit` was read, so the files of every earlier commit in a multi-commit push
never reached extraction. `changedFiles` is now the net effect over all delivered commits. Commits
are replayed in delivered order against a set of present paths: an added or modified path joins the
set and a removed path leaves it. A file added and then removed inside the same push disappears, a
file removed and then added again stays, and a file modified in several commits counts once. Paths
keep the position where they were first seen, and entries that are not strings are ignored.

GitHub does not document the order of `commits`, so the replay only runs when the last delivered
commit is the head of the push, that is, its id equals `after` or `head_commit.id` (a last commit
without a valid id never qualifies). When it is not, the order cannot be trusted and Qably falls
back to the union of added and modified paths across every commit and the head commit, minus the
paths the head commit removed. That can keep a file an earlier commit deleted, which is the safer
error: a deleted file left in the list fails when it is read, while a live file dropped from the
list would never be extracted. When `commits` is missing or empty (for example a payload that omits
it) only `head_commit` is used, as before.

The behavior change is that files from earlier commits of a multi-commit push are now extracted.
They still pass through `Project.testFilePatterns`, so only matching test files become a
`CodeChange`. Those files trigger AI extraction only when the push is to the repository's default
branch (or when the default branch is unknown); a push to any other branch or tag still records its
code changes but extracts nothing. See
[Which pushes start AI extraction](./RUN_INGESTION.md#which-pushes-start-ai-extraction).

A delivered commit whose id is missing, not a string or not a 40-character hex sha is still replayed
with the others: its additions, modifications and removals take part in the net effect, so its files
are never dropped from `changedFiles`. It is only left out of the stored `commits`. If it is the last
delivered commit, the order cannot be verified (see above), so the union fallback applies.

### Each code change names the last commit that touched its file

`CodeChange.commitSha` is the last commit of the push that touched the file, not the tip of the push.
Extraction reads the file at that sha, and the content there is the content at the tip, because no
later commit of the push touched it.

Each stored commit carries `scm_commit."attributedFiles"`: the paths a code change may be attributed
to that commit for. **It is not the list of files the commit touched**, it can be partial or empty,
and it must never be used to answer "which commits touched file X". The adapter fills it from the
paths the commit added, modified or removed (distinct, in the order the payload lists them: added,
modified, removed), but only the ones the commit can safely be named for:

- at most 1000 paths per commit; the rest are not attributed to it;
- empty when the delivered order is not verified (see above), because "later" is unknown;
- without a path that a later commit touched but that no stored commit records (a commit without a
  valid id, a repeated sha, or a path past the cap), so that no earlier commit is named for an older
  version of the file;
- empty for every commit stored before the column existed.

When the ingestion processor creates the code changes of an event, `lastCommitPerFile`
(`apps/api/src/modules/ingestion/lib/last-commit-per-file.ts`) maps every path to the stored commit
with the highest `position` whose `attributedFiles` lists it, and the code change takes that sha.
The evidence link of the code change still points at the file on the tip of the push.

The tip sha (`scm_event.commitSha`) is kept, as before, in every case where no stored commit is
attributed the file:

- the provider reports no commits (Bitbucket pushes, and any push without a `commits` list);
- the push was truncated and no kept commit is attributed the file;
- the delivered order is not verified (the last delivered commit is not the head of the push), so
  the adapter stores every commit with an empty `attributedFiles`;
- the file is not in the first 1000 paths of the last commit that touched it, or a later commit that
  could not be stored (invalid id, repeated sha) touched it, so the adapter leaves the path out of
  every earlier commit's `attributedFiles` instead of naming a commit with an older version of the
  file;
- the event was stored before the `attributedFiles` column existed: its commits read
  `attributedFiles = []` (the migration adds the column with a constant default and does not
  backfill), so its code changes keep the tip sha. Code changes already written are never rewritten.

### Pull requests and Bitbucket stay metadata-only

A `pull_request` payload carries neither a file list nor the commits of the branch. Those events
therefore report `changedFiles: []`, `commits: []`, `beforeSha: null`, `forced: false` and
`commitsTruncated: false`. The Bitbucket adapter reports the same neutral values for its events;
its push handling is unchanged.

## What counts as a test file

`Project.testFilePatterns` decides which files in a push are test files. It is the gate in front of everything expensive: only a matching file becomes a `CodeChange` that can trigger AI extraction, which is also the rule the thesis states — repository files, and only repository files, start AI generation.

`matchDeclaredTestPattern` (`packages/types/src/index.ts`) used to be a two-entry lookup table:

```ts
const DECLARED_TEST_SUFFIXES = { '*.spec.ts': '.spec.ts', '*.test.ts': '.test.ts' }
```

Any pattern that was not one of those two exact strings matched nothing, silently. A project testing with `.test.tsx`, pytest, JUnit or gtest could push test files all day and read "this change modified no test files" forever — while the extraction prompt and `packages/test-naming` both already knew those four conventions.

It is now a real glob matcher:

- `*` matches inside one path segment, `?` matches one character, `**` crosses any number of segments (`**/*.spec.ts` also matches a file at the root).
- A pattern with no `/` is matched against the file name, so `*.test.tsx` matches at any depth. A pattern containing `/` is matched against the whole path, so `apps/api/test/**` is anchored.
- Everything else is literal: the `.` in `*.spec.ts` is a dot, not "any character".

Compiled expressions are cached per pattern, because ingestion runs this over every file of every push.

Patterns are editable through `PATCH /projects/:id`. The validation is deliberately narrow: 1 to 20 entries, each 1 to 120 characters, and **every pattern must contain at least one character that is not `*`, `?` or `/`**. That last rule is what stops `**` from being declared — it would classify every changed file as a test and send an entire push to the model. A project always declares something, so an empty list is refused too; turning extraction off is what `Organization.aiEnabled` is for.

A new project is created with `["*.spec.ts", "*.test.ts", "*.spec.tsx", "*.test.tsx", "*.e2e-spec.ts"]`. The first two cover plain TypeScript tests. The `.tsx` pair covers React and Vue component tests. `*.e2e-spec.ts` covers Nest end-to-end specs: a name such as `review-inbox.e2e-spec.ts` ends in `-spec.ts`, not `.spec.ts`, so it never matched the plain spec pattern and its tests were never detected. The matcher needed no change for any of this, because the dot in a pattern is literal and each pattern is compared with the whole file name.

The list lives in two places that cannot import each other: the Prisma column default in `apps/api/prisma/schema.prisma`, and `DEFAULT_TEST_FILE_PATTERNS` in `packages/types`. `apps/api/src/modules/projects/default-test-file-patterns.spec.ts` fails when the schema or the latest migration drifts from the constant.

The migration `20261021120000_default_test_patterns_include_tsx` only changes the column default. It does not rewrite existing rows, on purpose: a project created before it keeps the patterns it has, and its `.tsx` and e2e test files stay undetected until someone adds `*.spec.tsx`, `*.test.tsx` or `*.e2e-spec.ts` in the repository panel. A backfill would change which files reach AI extraction, and spend credits, for projects whose owners never asked for it.

The editor lives inline in the repository panel (`test-file-patterns-editor.tsx`), next to the chips that already displayed the patterns, rather than behind a dialog: declaring what counts as a test is a small, reversible edit, and a modal would hide the changed-files list the user is reading it against. `validate-test-file-patterns.ts` mirrors the server rules so the wildcard-only case is explained in place instead of coming back as a 422.

## Credentials, and what is deliberately absent

`Connection` stores **no** GitHub OAuth credential. The required column that used to hold an
encrypted personal access token is gone. Every call that comes from a user action, the repository
picker and stack detection, uses the acting user's OAuth token, which better-auth keeps and
refreshes.

`Connection.encryptedAccessToken` is a different, optional column and is empty unless somebody sets
it. `PUT /projects/:projectId/repository/access-token` stores a token of 1 to 500 characters,
encrypted by `EncryptionService`, and `DELETE` on the same path clears it. Both require the `owner`
or `admin` role, and `GET /projects/:projectId/repository` reports only `hasAccessToken`, never the
value. `SourceReader` sends the token as a bearer credential when it reads a file, and sends an
unauthenticated request when there is none, which is enough for a public repository. The web client
has no screen for this token today.

Provider tokens are encrypted at rest through `account.encryptOAuthTokens`. This is not the default:
better-auth's `setTokenUtil` returns the token unchanged unless the option is set, which would leave
a credential with repository access sitting in plaintext in the database.

The webhook secret is the only secret Qably generates and encrypts itself. It is ours, not GitHub's.
The optional access token above is encrypted the same way, but it is supplied by a person.

## Accepted risk: the `repo` scope is broad

The GitHub sign-in requests the `repo` scope. That scope grants read and write access to every
repository the user can reach, while Qably only ever reads a repository listing and, later, file
contents.

This is deliberate, and it is a limitation of OAuth Apps rather than a design choice: GitHub offers
no narrower scope that can list **private** repositories. `public_repo` would restrict the listing to
public repositories, which does not serve software factories whose code is private.

Two consequences follow, and both are recorded as future work rather than solved here:

- **The connection belongs to a person, not to the organization.** If the user who linked the
  repository leaves, their token goes with them and the connection stops working.
- **The scope is wider than the need.** A GitHub App would grant per-repository, read-only access to
  contents and issue short-lived tokens, removing both problems.

Migrating to a GitHub App is the natural continuation, alongside the single-SCM-provider limit
recorded in the thesis (§1.6.2, limit 2).

## Detecting the stack from repository manifests

`GET /connections/detect-stack?repo=owner/name` reads the repository's manifests with the same OAuth
token and maps their dependencies onto the shared technology catalogue. The project form calls it
when a repository is picked and merges the result into the technology selection, never removing what
the user chose by hand.

Detection asks GitHub for the repository tree once, picks the manifests worth reading, and fetches
only those. It looks up to three directories deep, so a monorepo reports the stack of **every**
workspace rather than only what the root manifest declares — a root `package.json` that holds nothing
but `turbo` and `typescript` is exactly the case that used to report a repository as TypeScript and
nothing else. Dependency directories (`node_modules`, `vendor`) and build output (`dist`, `.next`,
`target`, …) are skipped, and at most twelve manifests are read per repository.

| Manifest | Detects |
| --- | --- |
| `package.json` | React, Next.js, Vue/Nuxt, Astro, Angular, NestJS, Express, Vite, Cloudflare, the PostgreSQL / MySQL / MongoDB / Redis drivers, the Playwright and Jest test runners, plus TypeScript or JavaScript |
| `composer.json` | PHP, and Laravel when a `laravel/*` package is required |
| `pom.xml`, `build.gradle`, `build.gradle.kts` | Java, Spring Boot, and the PostgreSQL / MySQL / MongoDB drivers |
| `pubspec.yaml` | Flutter, only when the manifest actually depends on the Flutter SDK |
| `requirements.txt`, `pyproject.toml` | Python, Django, FastAPI, and the psycopg / PyMySQL / PyMongo / redis clients |
| `go.mod` | Go, and PostgreSQL via `lib/pq` or `jackc/pgx` |
| `docker-compose.yml`, `docker-compose.yaml` | Docker, and the engine behind each `image:` — Postgres, MySQL/MariaDB, Mongo, Redis |

Test runners matter more here than anywhere else: Qably exists to orchestrate them, so knowing a
repository runs Playwright or Jest is the single most actionable thing detection can report.

The compose file is the cheapest reliable signal for a database engine, because a language manifest
often names an ORM rather than the engine behind it. It costs nothing extra: the tree listing that
finds the manifests already tells us the file is there.

**Deliberately not done: scanning source code.** Walking the repository tree to grep imports would
cost many API calls and produce weak evidence — a library imported in one test file does not make it
part of the stack. Manifests are a declaration of intent; loose code is circumstantial.

A polyglot repository reports every stack it declares. A Dart package that is not a Flutter app is
not reported as Flutter, and a manifest that fails to parse is skipped rather than guessed at.

## Background work has no OAuth credential

Because the picker and stack detection borrow the acting user's token, a process that runs without a
user present cannot use it. The ingestion worker only records code changes and enqueues extraction
jobs, so it does not need GitHub access. The extraction worker does read repository files on its own
schedule, through `SourceReader`, and it can only authenticate with the optional
`Connection.encryptedAccessToken`. Without one it reads as an anonymous caller, so a private
repository fails with an `http-<status>` reason, which the job records on the case (see
`AI_EXTRACTION.md`). A GitHub App installation token would replace both the per-user token
and the pasted one.

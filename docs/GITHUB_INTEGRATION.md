# GitHub Integration — How a Repository Reaches Qably

Qably links a project to a repository without asking anyone to generate or paste a personal access
token. The credential comes from the GitHub sign-in the user already performed.

## The flow

1. The user signs in with GitHub. `better-auth` stores the provider access token on the `account`
   row it already owns.
2. `GET /connections/available-repos` reads that token and asks GitHub for the repositories the user
   can reach, across their own account and the organizations they belong to.
3. The user picks a repository in the project form. The picker merges two sources into one list,
   ordered by most recent push so the repository someone touched today sits at the top: repositories
   already connected to the organization, and repositories that GitHub offers but Qably has not
   connected yet.
4. Picking an unconnected repository creates the `Connection` first, then creates the project
   pointing at it. Picking an already-connected one links straight to it.

A `Connection` belongs to the organization and owns the webhook secret. A `Project` points at a
`Connection` through a nullable foreign key, so the repository of a project is always **derived**
from its connection and never stored twice.

## Credentials, and what is deliberately absent

`Connection` stores **no** GitHub credential. The column that used to hold an encrypted personal
access token is gone. Every call to GitHub uses the acting user's OAuth token, which better-auth
keeps and refreshes.

Provider tokens are encrypted at rest through `account.encryptOAuthTokens`. This is not the default:
better-auth's `setTokenUtil` returns the token unchanged unless the option is set, which would leave
a credential with repository access sitting in plaintext in the database.

The only secret Qably still generates and encrypts itself is the per-connection webhook secret. That
one is ours, not GitHub's.

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
| `docker-compose.yml` | Docker, and the engine behind each `image:` — Postgres, MySQL/MariaDB, Mongo, Redis |

Test runners matter more here than anywhere else: Qably exists to orchestrate them, so knowing a
repository runs Playwright or Jest is the single most actionable thing detection can report.

The compose file is the cheapest reliable signal for a database engine, because a language manifest
often names an ORM rather than the engine behind it. It costs nothing extra: the root listing that
finds the manifests already tells us the file is there.

**Deliberately not done: scanning source code.** Walking the repository tree to grep imports would
cost many API calls and produce weak evidence — a library imported in one test file does not make it
part of the stack. Manifests are a declaration of intent; loose code is circumstantial.

A polyglot repository reports every stack it declares. A Dart package that is not a Flutter app is
not reported as Flutter, and a manifest that fails to parse is skipped rather than guessed at.

## Background work has no credential yet

Because every GitHub call borrows the acting user's token, any process that runs without a user
present cannot reach GitHub today. The ingestion worker currently does not need to — it only marks
events processed. The moment AI extraction needs to read repository files on its own schedule, this
becomes a blocker, and it is the point at which the GitHub App migration stops being optional.

# Qably API — Setup and Architecture

The `@qably/api` service is the transactional backend behind the Qably chain: repository change to test detection, AI extraction, human review, official versioned case, execution and evidence.

## Local setup

```bash
cd apps/api
docker compose up -d
cp .env.example .env
pnpm exec prisma migrate dev
pnpm exec prisma generate
pnpm start:dev
```

The generated Prisma client lives in `apps/api/generated` and is not committed, and `prisma migrate dev` does not regenerate it, so run `prisma generate` after a fresh clone and after every migration (`pnpm run build` also does it). The service listens on `PORT` (default `3001`). `GET /health` reports service and database status.

## Environment variables

`.env` is loaded by `dotenv/config`, imported as the very first statement in `src/main.ts` so it runs before Nest resolves the `ENV` provider. The Prisma CLI loads it separately through `prisma.config.ts`; the two paths are independent, so a variable that works for `prisma migrate` is not necessarily visible to the running service.

Values are then validated by `src/config/env.ts`. A missing or malformed variable aborts startup with an error naming every offending key — the service never starts in a partially configured state.

On a deployed environment the platform injects the variables directly and no `.env` file exists; `dotenv/config` is a no-op there.

| Variable | Required | Format | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` \| `test` \| `production` | Defaults to `development`. In `production` the exception filter hides internal error messages. |
| `PORT` | no | integer | HTTP port. Defaults to `3001`. |
| `DATABASE_URL` | yes | URL | PostgreSQL connection string used by the Prisma pg driver adapter. |
| `REDIS_URL` | yes | URL | Redis connection string for the BullMQ queues, the daily Aeris budget counter and report batching. |
| `BETTER_AUTH_SECRET` | yes | string, min 32 chars | Signing secret for better-auth sessions. |
| `BETTER_AUTH_URL` | yes | bare http(s) origin | Public base URL of the API itself. A path, query or fragment aborts startup; a trailing slash is accepted. |
| `WEB_APP_URL` | yes | bare http(s) origin | Browser origin of the Next.js web app. Sole allowed CORS origin and the only better-auth trusted origin. A path, query or fragment aborts startup; a trailing slash is accepted. |
| `ENCRYPTION_KEY` | yes | 64 hex chars | AES-256-GCM key for SCM webhook secrets, repository access tokens and notification webhook URLs at rest. Generate with `openssl rand -hex 32`. |
| `GITHUB_CLIENT_ID` | yes | string | GitHub OAuth application id. |
| `GITHUB_CLIENT_SECRET` | yes | string | GitHub OAuth application secret. |
| `GEMINI_API_KEY` | no | string | Key for the Gemini provider used by extraction, suite summaries and chat. Optional at boot: without it `AiModule` binds `DisabledExtractor`, chat reports the provider as unavailable, and extraction failures are recorded on the case. See `docs/AI_EXTRACTION.md`. |
| `GEMINI_MODEL` | no | string | Gemini model id used for extraction, suite summaries and chat. Defaults to `gemini-3.1-flash-lite` (see `src/config/env.ts` for the current value). |
| `AERIS_DAILY_BUDGET` | no | positive integer | Maximum Gemini calls per Pacific calendar day against the platform key, counted in Redis across extraction and chat. Unset means unmetered. |
| `RESEND_API_KEY` | no | string | Resend API key for transactional email: invitations, authentication emails and notification emails. Optional: when it is missing, `MailerService` logs a warning and skips the send. When supplied it must be non-empty. |
| `RESEND_FROM_EMAIL` | no | string | Sender address, for example `Display Name <address@domain>`. Set it together with `RESEND_API_KEY`. |

Local development values for `DATABASE_URL` and `REDIS_URL` match the `docker-compose.yml` services:

```
DATABASE_URL=postgresql://qably:qably@localhost:5432/qably
REDIS_URL=redis://localhost:6379
```

The API and the web app run on different ports, so every browser call from the web app is cross-origin:

```
BETTER_AUTH_URL=http://localhost:3001
WEB_APP_URL=http://localhost:3000
```

### Cross-origin access

Two independent gates must both name the web origin, or the session cookie never reaches the API:

1. **CORS** (`src/config/cors.ts`) — allows `WEB_APP_URL` with `credentials: true`, so the browser is permitted to attach and store the session cookie. Any other origin gets no `Access-Control-Allow-Origin` header.
2. **better-auth trusted origins** (`src/modules/auth/auth.options.ts`) — better-auth validates the `Origin` header of every auth request as CSRF protection and rejects unknown origins with `403` even when CORS already passed.

Both read the same normalized value through `resolveAllowedOrigins`, so they cannot drift apart.

Cookies work under `SameSite=Lax` while both apps share a site — different ports on `localhost`, or subdomains of one production domain. If the web app is ever deployed to a different registrable domain than the API, the session cookie becomes third-party and better-auth needs `advanced.defaultCookieAttributes` set to `sameSite: 'none'`, `secure: true`, `partitioned: true`. Safari's Intelligent Tracking Prevention can still block it. Keeping both on one domain avoids the problem entirely.

### The web client half

`apps/web` reaches the API through two clients, and both read the origin from `resolveApiBaseUrl()` (`src/lib/api-base-url.ts`). The better-auth client at `src/lib/auth-client.ts` handles sign-in, sign-up and the session. `apiRequest` in `src/lib/api-client.ts` handles every other call and attaches the `x-organization-id` header.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Origin of the Qably API, `http://localhost:3001` locally. Lives in `apps/web/.env`. |

Three constraints hold this together:

- `credentials: 'include'` on both clients (`fetchOptions.credentials` for better-auth, the `fetch` option in `apiRequest`). Without it the browser never attaches the session cookie to a cross-origin request, no matter how permissive CORS is.
- `NEXT_PUBLIC_` prefix. Next inlines the value into the browser bundle **at build time**, so a deployed build is frozen to whatever the variable held when `next build` ran. Setting it only at runtime does nothing.
- `next.config.ts` calls `resolveApiBaseUrl()` at load, so a missing or malformed value fails the build with the variable named instead of shipping a bundle that silently posts to the wrong origin.

`useAuth` (`src/features/auth/hooks/use-auth.ts`) wraps the sign-in, sign-up, GitHub sign-in and sign-out calls. Each action resolves to `{ error: string | null }` rather than throwing, so forms render a message instead of an error boundary. The session hooks and gates (`use-current-user`, `session-gate`, `guest-gate`) read the same client directly. `toAuthMessage` (`src/features/auth/lib/auth-errors.ts`) maps better-auth's `BASE_ERROR_CODES` to user-facing copy; `USER_NOT_FOUND` and `INVALID_EMAIL_OR_PASSWORD` deliberately produce the same sentence so the form cannot be used to enumerate registered accounts.

`validatePassword` (`src/features/auth/lib/validation.ts`) enforces 12 characters because `minPasswordLength` in `auth.options.ts` is 12. These two numbers must move together — a lower client rule just converts an inline field error into a round trip that fails.

### GitHub OAuth

`signIn.social({ provider: 'github', callbackURL })` sends the browser to GitHub and back. Two registrations must match or the flow dies at the redirect:

- The GitHub OAuth app's authorization callback URL must be `{BETTER_AUTH_URL}/api/auth/callback/github` — the **API** origin, not the web app's.
- `callbackURL` is where better-auth returns the browser after the exchange. It is validated against `trustedOrigins`, so it must sit under `WEB_APP_URL`.

## Organization scope

Every project-scoped route runs behind two guards in order: `SessionGuard` (global, via `APP_GUARD`) establishes *who* is calling, then `OrgScopeGuard` (route-level, via `@UseGuards`) establishes *which organization* they are calling as. `@CurrentOrg()` reads the result; it throws if the guard did not run, so a route can never silently operate without a scope.

`OrgScopeGuard` resolves the scope in one of two ways:

- No `x-organization-id` header — the caller's oldest membership.
- With the header — that organization, but only if the caller is a member. Otherwise `403`. This is what stops one organization from reading another's projects by guessing an id.

### Why the bootstrap is lazy

A user created by sign-up has no organization, so `resolveContext` creates one — name, slug, and an `owner` membership — inside a single `$transaction`.

This deliberately does **not** live in better-auth's `databaseHooks.user.create.after`. That hook runs through `queueAfterTransactionHook`, meaning it fires *after* the user-creation transaction has already committed and it never receives the transaction adapter. A failure there would leave a committed user with no organization and no way to retry. Resolving lazily on first use is idempotent instead: it is correct for users created by email sign-up, by GitHub OAuth, by a seed script, or by hand in psql, and it self-heals any user that somehow lost their membership.

Slug collisions are handled by retrying `withSlugSuffix` up to five times on a `P2002`; any other database error is rethrown rather than swallowed.

### Plan limits

Limits live in code, not on the `Organization` row: `PLAN_LIMITS` in `@qably/types` maps each `Plan` to its project, member, and monthly Aeris credit caps, so a manual `plan` change takes effect on the next check with no column to keep in sync.

`PlanEntitlementsService` (`apps/api/src/modules/organizations/plan-entitlements.service.ts`) enforces them. `ensureProjectAllowance` locks the organization row (`SELECT plan ... FOR UPDATE`) before counting projects, then creates inside the same `$transaction` — the lock closes the count-then-insert race that a bare transaction cannot, since two concurrent reads under READ COMMITTED would both see the same count. `ProjectsService.create` calls it before insert; exceeding the cap returns `plan-limit-reached`, which the controller maps to `403`. A plan with no project cap (`projects: null`, Empresa) skips the count entirely.

Organizations that already exceed their plan's cap keep every existing project — the check only blocks *new* creation, never reads.

`ensureSeatAllowance`/`countSeats` apply the same lock-then-count shape to members plus pending (unaccepted, unrevoked, unexpired) `OrgInvite` rows; the invite and member-management units wire it in.

### Roles

`owner` and `admin` may delete a project; `member` may not. The check happens before the lookup, so a member probing ids cannot tell an existing project from a missing one.

Services return `Result<T, ProjectError>` rather than throwing. The controller owns the mapping to HTTP — `not-found` → 404, `name-taken` → 409, `plan-limit-reached` and `forbidden` → 403 — so the domain layer stays free of transport concerns.

## Suites and test cases

`Suite` carries `organizationId` alongside `projectId`. The duplication is deliberate: `OrgScopeGuard` already resolved an organization, so every suite query filters on it directly instead of joining through `Project` on each read.

`TestCase` rows are ordered by an explicit `position` column rather than `createdAt`, so reordering never depends on insert time. New cases append at `cases.length`.

Every case mutation returns the **whole suite**, not the case. The UI renders a suite with its cases embedded, so returning the parent removes a second round trip and the chance of the client holding a stale sibling list.

### One default suite per project

`isDefault` is enforced in application code, not by a constraint: promoting a suite runs `updateMany` to demote its siblings and the update itself inside one `$transaction`. A partial unique index would reject the intermediate state during a swap, so the invariant lives in the transaction instead.

## Shared contract

`packages/types` is the single source of truth for shapes crossing the API/web boundary. The API imports it; `apps/api/src/**/*.contracts.ts` files alias those types rather than redeclaring them.

`Project` holds only the persisted fields the API can return. `ProjectListItem` extends it with `suiteCount` and an `activity` object (`healthScore`, `lastRunStatus`, `lastRunAt`, `activeRunCount`, and an optional `aiPendingCount` the API does not fill today) that `ProjectsService` computes from runs. `activity` is `null` for a project that has never run, and `healthScore` is `null` when no run falls inside the metrics window, so the UI never renders an invented zero. `ProjectSummary`, the older flat shape, is only used by the web mock store and its test fixtures.

Nullable columns are returned as **omitted keys**, never `null`, so one optional TypeScript property describes both the Prisma row and the JSON payload.

## Architecture

Modules are organised by feature, not by technical layer. Each feature module owns its controllers, services, repositories and contracts.

```
src/
├── config/     environment parsing, CORS and the global ENV provider
├── common/     Result type, Zod validation pipe, exception filter, access log, throttler, crypto, locale and prompt helpers
├── prisma/     PrismaService and the adapters that implement feature contracts
├── health/     liveness and database readiness
├── reporter/   serves the CI reporter script at GET /report.mjs
└── modules/    one folder per feature
    ├── auth, organizations, invites, api-keys    sessions, organization scoping, membership, programmatic keys
    ├── projects, connections, repository         projects, SCM connections, per-project repository settings
    ├── ingestion                                 SCM webhooks, code changes
    ├── suites, runs                              suites and cases, executions and results
    ├── review, proposal-classification           extraction jobs, proposals, approval, duplicate classification
    ├── ai, chat                                  Gemini integration, project chat
    └── dashboard, notifications, mailer          aggregates, notifications, email
```

### Dependency inversion

A feature module declares the capability it needs as an interface plus an injection token, and never imports a concrete infrastructure class. `health/health.contracts.ts` declares `DatabaseProbe` and `DATABASE_PROBE`; `prisma/prisma-database.probe.ts` implements it; `health/health.module.ts` binds the two.

This keeps feature services testable without a database and prevents Prisma types from leaking into domain logic.

### Error handling

Domain operations that can fail for expected reasons return `Result<T, E>` from `common/result.ts` — a discriminated union narrowed through `isOk` and `isErr`. Expected failures are values, not exceptions.

`AllExceptionsFilter` handles everything that reaches the HTTP boundary. It preserves the status and body of a thrown `HttpException`, including the structured `issues` array produced by `ZodValidationPipe`, and maps anything else to `500`. Outside production the underlying message is exposed; in production it is replaced with a generic message so connection strings and credentials cannot leak.

### Authentication

better-auth backs email and password sign-in plus GitHub OAuth. Its HTTP handler is mounted at `/api/auth/*` by `AuthController`, which marks that route `@Public()` because better-auth performs its own credential checks.

`SessionGuard` is registered as an `APP_GUARD`, so **every route is protected by default**. A route opts out with `@Public()`. The guard resolves the session through the `SessionReader` port rather than calling better-auth directly, which keeps feature tests free of the auth library.

A failed session lookup is logged with its stack and answered with a generic `401 Authentication required`; the underlying reason never reaches the caller.

Inside a protected handler, `@CurrentUser()` returns the authenticated user. It throws if the route is not covered by `SessionGuard`, so a missing guard fails loudly instead of yielding `undefined`.

Nest's own body parser is disabled (`bodyParser: false` in `main.ts`) and `configureHttpPipeline` installs the parsers by hand after Helmet and CORS. A JSON parser that also keeps the raw body runs on every path except `/api/auth`, because better-auth needs to read the raw request body. A text parser for `application/xml` and `text/xml` runs only on `POST /runs/ingest/junit`, with a 10 MB limit.

#### Testing against better-auth

better-auth ships as ESM and its transitive dependencies cannot be loaded by the CommonJS Jest runtime. The e2e suite maps `better-auth`, `better-auth/node` and `better-auth/adapters/prisma` to stubs in `test/stubs/`, and overrides `AUTH_INSTANCE` and `SESSION_READER`. The `betterAuth` and `prismaAdapter` stubs throw when called, so a test that forgets to override a provider fails loudly rather than silently exercising a fake.

### Input validation

Request payloads are validated with Zod schemas through `ZodValidationPipe`. A rejected payload produces `400` with a `issues` array of `{ path, message }` entries.

## Prisma notes

Prisma 7 no longer accepts `url` in `schema.prisma`. The connection string lives in `prisma.config.ts` for the CLI, and `PrismaService` passes it to `PrismaClient` through the `@prisma/adapter-pg` driver adapter.

The client generator is pinned to CommonJS output so the generated code runs under both `nest build` and ts-jest:

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../generated/prisma"
  moduleFormat        = "cjs"
  runtime             = "nodejs"
  importFileExtension = ""
}
```

Without `moduleFormat = "cjs"` the generated client emits `import.meta` and Jest fails to parse it. Without `importFileExtension = ""` the generated modules import `./enums.js`, which resolves at runtime but not under ts-jest.

Derived project figures — health score, suite count and active run count — are computed in queries rather than stored, so they cannot drift from the rows they summarise.

## Verification

```bash
pnpm --filter @qably/api exec tsc --noEmit
pnpm --filter @qably/api lint
pnpm --filter @qably/api test
pnpm --filter @qably/api test:e2e
pnpm --filter @qably/api build
```

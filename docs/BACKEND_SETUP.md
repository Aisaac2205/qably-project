# Qably API — Setup and Architecture

The `@qably/api` service is the transactional backend behind the Qably chain: repository change to test detection, AI extraction, human review, official versioned case, execution and evidence.

## Local setup

```bash
cd apps/api
docker compose up -d
cp .env.example .env
pnpm exec prisma migrate dev --name init
pnpm start:dev
```

The service listens on `PORT` (default `3001`). `GET /health` reports service and database status.

## Environment variables

`.env` is loaded by `dotenv/config`, imported as the very first statement in `src/main.ts` so it runs before Nest resolves the `ENV` provider. The Prisma CLI loads it separately through `prisma.config.ts`; the two paths are independent, so a variable that works for `prisma migrate` is not necessarily visible to the running service.

Values are then validated by `src/config/env.ts`. A missing or malformed variable aborts startup with an error naming every offending key — the service never starts in a partially configured state.

On a deployed environment the platform injects the variables directly and no `.env` file exists; `dotenv/config` is a no-op there.

| Variable | Required | Format | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` \| `test` \| `production` | Defaults to `development`. In `production` the exception filter hides internal error messages. |
| `PORT` | no | integer | HTTP port. Defaults to `3001`. |
| `DATABASE_URL` | yes | URL | PostgreSQL connection string used by the Prisma pg driver adapter. |
| `REDIS_URL` | yes | URL | Redis connection string for BullMQ ingestion and extraction queues. |
| `BETTER_AUTH_SECRET` | yes | string, min 32 chars | Signing secret for better-auth sessions. |
| `BETTER_AUTH_URL` | yes | http(s) URL | Public base URL of the API itself. |
| `WEB_APP_URL` | yes | http(s) URL | Browser origin of the Next.js web app. Sole allowed CORS origin and the only better-auth trusted origin. Path, query and trailing slash are ignored — only scheme, host and port are compared. |
| `ENCRYPTION_KEY` | yes | 64 hex chars | AES-256-GCM key for provider tokens and webhook secrets at rest. Generate with `openssl rand -hex 32`. |
| `GITHUB_CLIENT_ID` | yes | string | GitHub OAuth application id. |
| `GITHUB_CLIENT_SECRET` | yes | string | GitHub OAuth application secret. |
| `ANTHROPIC_API_KEY` | no | string | Key for the AI extraction provider. Optional because extraction ships last and the provider is not yet chosen; when supplied it must be non-empty. The Unit 3 extraction service requires it at its own boundary, and this variable is renamed if a provider other than Claude is selected. |
| `RESEND_API_KEY` | no | string | Resend API key for run notifications. Optional because notifications ship last; when supplied it must be non-empty. The Unit 4 notification service requires it at its own boundary. |

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
2. **better-auth trusted origins** (`src/auth/auth.options.ts`) — better-auth validates the `Origin` header of every auth request as CSRF protection and rejects unknown origins with `403` even when CORS already passed.

Both read the same normalized value through `resolveAllowedOrigins`, so they cannot drift apart.

Cookies work under `SameSite=Lax` while both apps share a site — different ports on `localhost`, or subdomains of one production domain. If the web app is ever deployed to a different registrable domain than the API, the session cookie becomes third-party and better-auth needs `advanced.defaultCookieAttributes` set to `sameSite: 'none'`, `secure: true`, `partitioned: true`. Safari's Intelligent Tracking Prevention can still block it. Keeping both on one domain avoids the problem entirely.

### The web client half

`apps/web` talks to the API through a single better-auth client at `src/lib/auth-client.ts`. It is the only place allowed to know the API exists.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Origin of the Qably API, `http://localhost:3001` locally. Lives in `apps/web/.env`. |

Three constraints hold this together:

- `fetchOptions.credentials: 'include'` on the client. Without it the browser never attaches the session cookie to a cross-origin request, no matter how permissive CORS is.
- `NEXT_PUBLIC_` prefix. Next inlines the value into the browser bundle **at build time**, so a deployed build is frozen to whatever the variable held when `next build` ran. Setting it only at runtime does nothing.
- `next.config.ts` calls `resolveApiBaseUrl()` at load, so a missing or malformed value fails the build with the variable named instead of shipping a bundle that silently posts to the wrong origin.

`useAuth` (`src/features/auth/hooks/use-auth.ts`) is the only consumer of the client in feature code. It returns `{ error: string | null }` rather than throwing, so forms render a message instead of an error boundary. `toAuthMessage` (`src/features/auth/lib/auth-errors.ts`) maps better-auth's `BASE_ERROR_CODES` to user-facing copy; `USER_NOT_FOUND` and `INVALID_EMAIL_OR_PASSWORD` deliberately produce the same sentence so the form cannot be used to enumerate registered accounts.

`validatePassword` enforces 12 characters because `minPasswordLength` in `auth.options.ts` is 12. These two numbers must move together — a lower client rule just converts an inline field error into a round trip that fails.

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

`Organization.maxProjects` is checked in `ProjectsService.create` before insert, counting only that organization's projects. Exceeding it returns `plan-limit-reached`, which the controller maps to `403`. `maxUsers` and `maxCases` are declared on the model but not yet enforced — they belong to the membership and test-case units.

### Roles

`owner` and `admin` may delete a project; `member` may not. The check happens before the lookup, so a member probing ids cannot tell an existing project from a missing one.

Services return `Result<T, ProjectError>` rather than throwing. The controller owns the mapping to HTTP — `not-found` → 404, `name-taken` → 409, `plan-limit-reached` and `forbidden` → 403 — so the domain layer stays free of transport concerns.

## Architecture

Modules are organised by feature, not by technical layer. Each feature module owns its controllers, services, repositories and contracts.

```
src/
├── config/     environment parsing and the global ENV provider
├── common/     Result type, Zod validation pipe, exception filter
├── prisma/     PrismaService and the adapters that implement feature contracts
├── health/     liveness and database readiness
├── auth/       sessions, guards, organisation scoping
├── repository/ SCM connections, webhooks, ingestion, code changes
├── review/     AI extraction, proposals, atomic approval
└── runs/       executions, results, evidence, notifications
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

Express's JSON body parser is disabled globally and re-applied to every path except `/api/auth`, because better-auth needs to read the raw request body.

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

Derived project figures — health score, suite count, active run count, pending proposal count — are computed in queries rather than stored, so they cannot drift from the rows they summarise.

## Verification

```bash
pnpm --filter @qably/api exec tsc --noEmit
pnpm --filter @qably/api lint
pnpm --filter @qably/api test
pnpm --filter @qably/api test:e2e
pnpm --filter @qably/api build
```

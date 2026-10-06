# Qably Web Vertical Slices

Each folder under `src/features/` is an isolated domain slice. A slice manages its own components, hooks, utilities, test files, and local context providers.

## Slices

- `ai-review`: The Aeris project chat: conversation threads, case attachment, and sending generated cases to the review inbox.
- `auth`: Login, account registration, form validation, and Better Auth session hooks.
- `dashboard`: Organization overview: KPI cards, executed-cases comparison chart, projects table, case-priority donut, channel delivery, recent activity, and the traceability contribution calendar (not rendered by any page today).
- `integrations`: Repository connection components, SCM webhook setup, and Slack and Discord notification webhook management.
- `notifications`: In-app notification list and menu, and per-event in-app and email preferences. Slack and Discord webhook URLs are managed in `integrations`.
- `organizations`: API clients and hooks for organizations, members, invitations and plan usage, and the invitation acceptance view. Organization switching lives in `components/shell/sidebar-account.tsx`; member and invitation management lives in `settings`.
- `projects`: Project creation and settings, with sub-folders for `repository`, `suites` (the test library), `quality` and `api-keys`.
- `review-inbox`: Triage queue for AI-proposed test cases, duplicate comparison, and approve and reject decisions.
- `runs`: Runs page with Actions and Manual tabs, CI run and run detail pages, and the new-run dialog.
- `settings`: Plan and usage, members and invitations, and language. The notification preferences and webhook panels come from `notifications` and `integrations`.

## Conventions

- Tests live in a `test/` subfolder of the slice. Some hook, API-client and library tests sit next to their source file.
- Tests follow React 19 testing patterns.
- Icons rely exclusively on `@phosphor-icons/react`. Lucide and bespoke SVGs are excluded.
- Colors rely strictly on CSS custom property tokens. No raw hex, rgb, or oklch strings in components.
- Typography uses Geist Sans for copy and Geist Mono for numerical metrics and code snippets.
- Status chips always display an icon paired with a text label for accessibility.
- Animations respect `prefers-reduced-motion`.

## Cross-Slice Primitives

Located in `apps/web/src/components/`:

- `ui/`: Customized shadcn/ui primitives (Button, Input, Label, Select, Dialog, Tabs, Card, Spinner, StateView, and others).
- `shell/`: Application shell components including AppShell, Sidebar, TopBar, and Breadcrumbs.
- `charts/`: Area, bar, line and pie chart primitives used by the dashboard and quality pages.

## Data Layer

The application queries backend endpoints using the HTTP client in `src/lib/api-client.ts` orchestrated by TanStack Query. Tests seed the query cache with fixtures from `src/test/*-api-stub.ts` and `src/lib/mock-data.ts`; the in-memory store in `src/lib/mock-store.ts` is built from the same mock data; only the linked-proposal lookup on the project repository page still reads it.

## Creating a Slice

1. Create a directory at `apps/web/src/features/<slice>/`.
2. Add subdirectories: `components/`, `hooks/`, `test/`, and optionally `lib/` and `api/`.
3. Document the slice in this README.
4. Mount the slice components into the route tree under `apps/web/src/app/(app)/`.

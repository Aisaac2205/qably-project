# Paged suite list

The suites list of a project is read page by page through `GET /suites/summaries`. Each page holds at most `limit` suite summaries without cases, with the derived status and pass rate already computed. Search, tag filter, status filter, and order run on the server, so they find suites the screen has not loaded yet.

Before this change the list downloaded `GET /suites` (every suite with every case) and `GET /runs/suite-metrics` (the full run history of every suite) and filtered on the client. The cost grew with the history, not with what the screen showed.

## At a glance

| Piece | Where |
|---|---|
| List | `GET /suites/summaries` |
| Project tags | `GET /suites/tags` |
| Status and pass rate derivation | `deriveSuiteRunStatus` in `packages/types/src/suite-run-status.ts` |
| Ordering, comparator, search, and tag facet | `packages/types/src/suite-summaries.ts` |
| Cursor | `apps/api/src/modules/suites/lib/suite-summaries-cursor.ts` |
| Controller and service | `suite-list.controller.ts` and `suite-list-query.service.ts` in `apps/api/src/modules/suites/` |
| Web client | `apps/web/src/features/projects/suites/` |

## Routes

### `GET /suites/summaries`

| Parameter | Rule | Default |
|---|---|---|
| `projectId` | non-empty string, required | |
| `limit` | integer from 1 to 100 | 50 |
| `sort` | `recent`, `name`, `pass-rate`, or `cases` | `recent` |
| `search` | trimmed; 1 to 200 characters after trimming | no search |
| `tag` | 1 to 40 characters, a single tag, not trimmed | no tag |
| `status` | `running`, `pass`, `fail`, `needs-attention`, or `never-run` | no filter |
| `cursor` | opaque string of 1 to 2048 characters | first page |

The response is `{ items: SuiteSummary[], nextCursor: string | null }`. `nextCursor` is always present. It is `null` on the last page and non-null if and only if more items remain. The response carries no total.

| `SuiteSummary` field | Content |
|---|---|
| `id`, `projectId`, `name`, `description` | `Suite` columns |
| `tags` | The suite's tags |
| `isDefault` | Default-suite flag |
| `createdAt` | ISO 8601 with milliseconds |
| `caseCount` | Integer, 0 or greater |
| `status` | Status derived from the 10 most recent runs |
| `recentPassRate` | Integer from 0 to 100, or `null` |

A summary never includes `cases` or case content.

### Scope and errors

The route uses `OrgScopeGuard`. It answers 401 without a session and 403 for a foreign organization header. Every read filters by the caller's organization and project, including requests that carry a cursor. A `projectId` from another organization answers 200 with `{ items: [], nextCursor: null }`.

Any violation of the parameter table answers 400 in the `ZodValidationPipe` format: `message: 'Validation failed'` and an `issues` list of `{ path, message }`, where `path` is a joined string. A malformed cursor, or one issued for another `sort`, is an issue on `cursor`.

### `GET /suites/tags`

Takes a required `projectId` and returns `{ items: string[] }` with the distinct tags of the project's suites. Tags are case-sensitive and sorted by UTF-16 code unit (`Array.prototype.sort()`). The result does not depend on `search`, `status`, or `tag`. A foreign or empty project returns `{ items: [] }`. The route uses `OrgScopeGuard` and the same 401, 403, and 400 answers.

## Ordering and tie-breaks

The order is total: each `sort` defines a complete key that includes its tie-breaks.

| `sort` | Key | Tie-breaks |
|---|---|---|
| `recent` | `createdAt` descending | `id` descending |
| `name` | `name` ascending, using the collation below | `id` ascending |
| `pass-rate` | `recentPassRate` descending, `null` last | `createdAt` descending, `id` descending |
| `cases` | `caseCount` descending | `createdAt` descending, `id` descending |

- `createdAt` is compared as an instant with `Date.parse`, not as text, because the web test fixtures use ISO strings without milliseconds.
- `id` is compared by code unit.
- Names are ordered with `Intl.Collator('en', { sensitivity: 'base' })`. It ignores case and diacritics, so "Alpha" and "alpha" tie and "ñ" sorts next to "n". Ties fall to `id`. The collation depends on neither the database server nor the runtime environment, and the web test stub uses the same one.
- The previous name order came from `localeCompare` in the browser, which depends on the environment, and ties kept the server order (`isDefault` descending, `createdAt` descending). The default suite stayed pinned between ties only by accident, and that pinning is gone.

## Cursor

The cursor is an opaque string. The client sends it back as received and never interprets it.

- It encodes the version (currently 1), the `sort`, and the full sort key of the last item on the page: `createdAt` and `id` for `recent`; the name and `id` for `name`; the value, `createdAt`, and `id` for `pass-rate` and `cases`.
- It is bound to the `sort`, not to the filters. A cursor from another `sort` answers 400. A cursor used with different filters is still a valid position in the same total order, and the organization and project scope always comes from the request, never from the cursor. The client restarts pagination whenever a filter changes.
- The cut is by value: the next page starts at the first item strictly after the cursor's key. If the cursor's item was deleted, pagination continues without an error and without looking the row up.
- A cursor is rejected with 400 when it is not base64url, is not a JSON array with the arity of its `sort`, carries another version, has an empty `id`, has a `createdAt` that is not canonical ISO, has a pass rate outside 0 to 100, or has a case count that is not a non-negative safe integer. The cursor value never reaches a SQL statement. It only cuts the in-memory list.
- The version field allows the read strategy to change later without breaking the contract.

## Stability across pages

| Order or filter | What happens when data changes between two pages |
|---|---|
| `recent` | Stable under inserts and renames, because `createdAt` never changes |
| `name` | Stable under inserts. A rename between two pages can repeat or skip a suite, because `updateSuiteSchema` allows renames |
| `pass-rate`, `cases`, and the `status` filter | Depend on runs and cases, which change. A suite can repeat or be skipped across pages |

The client deduplicates by `id` and keeps the first occurrence. A cursor whose position no longer reaches any row answers 200 with `items: []` and `nextCursor: null`.

## Search and filters

A suite must satisfy every filter that is present, and all filters apply before the page is cut.

| Filter | Semantics |
|---|---|
| `search` | Case-insensitive substring, evaluated on `name` or on `description` separately. `%`, `_`, and `\` are literal |
| `tag` | Exact, case-sensitive membership: `api` matches neither `API` nor `api-v2` |
| `status` | The suite's derived status, computed before the page is cut |

Search and tag run in memory with pure functions from `@qably/types`, not in SQL. Prisma does not escape `%` or `_` in `contains`, and the API tests mock Prisma, so a database collation could not be tested.

Two differences from the previous list:

- **Search per field.** The client used to search one string, `name + ' ' + description`, so "login flow" matched the name "Login" with the description "flow…". Now `login` and `flow` each match on their own, and "login flow" matches nothing.
- **Lowercasing without diacritic folding.** Matching uses JavaScript's `toLowerCase()`. "ÁRBOL" matches "árbol", but "arbol" does not match "árbol".

## Status and pass rate

A suite's window is its 10 most recent runs, ordered by `startedAt` and `id` descending, of any `source` and any state. `deriveSuiteRunStatus` receives those statuses from oldest to newest and returns `{ status, recentPassRate }`.

- Completed runs are `pass` and `fail`. `recentPassRate` is `Math.round(pass / completed * 100)`, an integer from 0 to 100, or `null` when no run has completed.
- `status` is `running` when any run in the window is running, and `never-run` when the window is empty. It is `needs-attention` when no run has completed or the pass rate is below 70. Otherwise it is `pass` or `fail`, following the last completed run.
- The API and the web test stub share this single function, exported with `SUITE_RUN_WINDOW` (10) and `SUITE_PASS_RATE_THRESHOLD` (70). The web no longer keeps a derivation of its own.

## Case count

`caseCount` counts every case in the suite regardless of `state` or `executionMode`, matching `cases.length`. A suite without cases has `caseCount: 0`, never `null`, and sorts last under `cases`.

## Cost of a request

The service computes everything per request, without denormalizing status or pass rate onto `Suite`. It makes at most three reads, a number that does not depend on how many suites the project has:

| Read | Content | When |
|---|---|---|
| Project suites | `id`, `projectId`, `name`, `description`, `tags`, `isDefault`, `createdAt`, filtered by organization and project | Always |
| Case counts | One `testCase.groupBy` on `suiteId`, limited to the ids that passed `search` and `tag` | When any suite remains |
| Run windows | One SQL query with `CROSS JOIN LATERAL` and `LIMIT 10` per suite | When there are ids to resolve |

The path of the request decides which ids reach the third read:

- **Default path** (`sort` is `recent`, `name`, or `cases`, and there is no `status`). The service sorts, cuts the page, and reads windows only for the suites on the page, at most `limit` of them.
- **Status first** (`sort=pass-rate`, or `status` present). The order or filter depends on the status, so the service reads the windows of every candidate, derives the status, filters, sorts, and cuts.

No read returns case content or `run_case` rows, and none reads more than 10 runs per suite.

The work does grow with the number of suites. Every page rereads the project's suites and filters and sorts them in memory. In addition, an invalidation on the web refetches every loaded page in sequence, starting from the first.

### The relation count trap

The initial design counted cases with `_count: { select: { cases: true } }`. Prisma 7 compiles that count into a `LEFT JOIN` against the subquery `SELECT "suiteId", COUNT(*) FROM test_case WHERE 1=1 GROUP BY "suiteId"`. The aggregate is not filtered by project or organization, so every page would have counted all cases of all organizations. The review before the first push caught it.

The scoped `groupBy` in the table above replaces it, with `where: { suiteId: { in: ids } }`. Its scope is the ids of the suites the caller already read under their organization and project. It keeps the semantics of the relation count and can use the `@@index([suiteId])` index.

### Measurement on production

On 2026-10-06 a read-only `EXPLAIN ANALYZE` ran on PostgreSQL 18. The measured project had several hundred suites and about twenty thousand runs.

| Query | Plan | Time |
|---|---|---|
| LATERAL windows over every suite of the project (worst case, status-first path) | `Index Scan Backward` on `run_suiteId_startedAt_idx`, `Incremental Sort`, and `Limit`. One loop per suite of about 10 rows each, no `Seq Scan` on `run` | 15 ms |
| `ROW_NUMBER` window of `GET /runs/suite-metrics` | `Seq Scan` over every run of the project and a sort | 38 ms |
| Case-count `groupBy` | `Seq Scan` and `HashAggregate` | 6 ms |

Reading the light suite columns took under 1 ms.

The `Seq Scan` on the count is the right plan when the id list covers most of `test_case`, as it did in this measurement. On a larger table the planner can use the `suiteId` index instead.

### When to revisit

Revisit the strategy if a project exceeds 2,000 suites or if the p95 of the list exceeds 300 ms in the API logs. The alternative is a SQL path for `recent` and `name` with a version 2 cursor.

A hard ceiling also exists: a query binds at most 65,535 parameters, and the id lists bind one parameter per id.

## Route registration

`SuiteListController` is the first entry of `SuitesModule.controllers`, ahead of `SuitesController`, which declares `GET /suites/:id`. With the order reversed, `summaries` and `tags` are read as suite ids. The `:id` handler looks up a suite with that id, finds none, and answers 404, and the list never runs.

NestJS 11.1.27 registers modules, then controllers in array order, then methods in declaration order. The `routeResolutionStrategy` option does not exist in that version, and the documentation that describes it belongs to a later release. `apps/api/test/suite-list.e2e-spec.ts` protects the order. It imports the real `SuitesModule`, and reversing the array makes the tests of both routes fail (31 of its 39 tests).

If local registration order stops being enough, plan B is to move the routes under their own prefix, `/suite-summaries`. That avoids the shadowing at the cost of splitting the resource.

## Web client

### Data and cache

- `useSuiteSummaries` uses `useInfiniteQuery` with pages of 50 (`SUITE_SUMMARIES_PAGE_SIZE`). The key is `['suites', 'summaries', projectId, query]`, where the normalized query never contains `all` or empty values. Tags live under `['suites', 'tags', projectId]`. `suiteKeys.list` did not change.
- While a new query for the same project loads, the list keeps the previous rows (`placeholderData`) and sets `aria-busy`. A different project keeps nothing.
- A suite update patches `name`, `description`, `tags`, `isDefault`, and `caseCount` in every page of every cached variant of the project, without reordering, and then invalidates. When the suite becomes the default, the others lose the flag. A renamed suite stays in place until the refetch lands.
- Deleting a suite removes it from every page before invalidating. Creating a suite inserts no row, because its position depends on the server order, and invalidates summaries and tags. Creating or deleting a case patches `caseCount`.
- Creating a run invalidates the summaries. Recording a case result marks them stale with `refetchType: 'none'`, because it recalculates and persists `run.status`, which the status indicator shows. Deciding a review inbox proposal invalidates `suiteKeys.all`, which covers summaries and tags.
- There is no `refetchInterval`. If polling becomes necessary, limit the pages with `maxPages` or refresh only the first page.

### Interaction

- **"Load more" button instead of infinite scroll.** The list serves to find and compare suites, tasks for which the Nielsen Norman Group advises against infinite scrolling. The button leaves loading under the control of keyboard users and makes it possible to move focus predictably. The code never creates an `IntersectionObserver`.
- **Search debounce of 300 ms.** Status, tag, and order apply immediately. The input accepts 200 characters, the same ceiling the API validates.
- **IME composition.** While a composition is open, the search is not applied. It applies 300 ms after the composition ends, and the composition closes on blur and when the filters are cleared.
- **Focus after loading more.** If focus was still on the button, it moves to the link of the first new row. If the user moved it elsewhere, it stays there. If no new rows arrived and the button unmounted, focus moves to the list. A pending handoff is dropped when the filters or the project change, or when the request fails. After a successful retry of a failed first load, focus moves to the first row or to the empty state.
- **Announcements.** A `role="status"` region with `aria-live="polite"` and `aria-atomic`, always mounted and visible only to screen readers, announces "N more suites loaded" after a page loads and "N suites shown" when a change of search, filter, or order settles. The count is of loaded rows, not a total. Nothing is announced on first mount. The texts are plural keys with `_one` and `_other` suffixes (`suites.loadedMoreSuites` and `suites.suitesShown`), with no count branching in the component.
- **Focus on load errors.** The error takes focus unless focus is inside the list itself (the filter bar or the results) and still connected to the document. A failure after typing in the search keeps focus and the keystrokes in the field. If focus is on the body, on a sidebar link, or on a detached node, it moves to the error.
- **Empty states.** "No suites yet" appears only when no filter is active. With filters active and no results, "No suites match your filters" appears with a "Clear filters" button. The decision uses the filters the server received, so a blank search or the value `all` does not count.
- **Filters.** Clearing the filters resets search, status, and tag, never the order, and returns focus to the search field. The clear button of the mobile filters sheet leaves the search alone. The tag selector offers the tags of the whole project (the facet) plus the active tag when the facet no longer has it. The value `all` is the "all tags" sentinel, so a tag literally named "all" cannot be selected (a limitation that predates this change).

### List and row composition

`SuiteList` is a container that composes the filter bar (`SuiteListToolbar`) and the results area (`SuiteListResults`), and takes the filter state (search, status, tag, and order) from `useSuiteListFilters`. The results area tells two empty states apart: a project without suites (a heading, a hint, and a "New suite" link) and a filter that excludes everything (a message and a clear button).

`SuiteRow` uses a three-column grid, `[icon][name, description, tags, and default-suite star][status indicator]`, the same at every size. Only the gaps and the padding change. From `md` up, the indicator column has a fixed width (`md:w-32`), sized for the longest status label (in Spanish, "Requiere atención"), so the indicator and the name column line up the same way on every row.

## Retirement of `GET /runs/suite-metrics`

The route walked the whole run history of every suite with `ROW_NUMBER() OVER (PARTITION BY "suiteId")` and discarded everything except the 10 most recent runs. Its data moved into the summary as `status` and `recentPassRate`.

- A request to `GET /runs/suite-metrics` now falls into `GET /runs/:id` and answers 404 with `{ code: 'not-found', message: 'Run not found' }`, without reading any run window.
- The change removed the service method, the route, the query schema, the contract, `lib/suite-metrics.ts` with its test file, and the `SuiteMetrics*` types of `@qably/types`. On the web it removed the `useSuiteMetrics` hook, the client-side derivation, `getSuiteMetrics`, `useSuiteMetricsQuery`, and `runKeys.suiteMetrics`.
- The retirement ships in a later push than the one that removed the last web consumer, after the new web is deployed. Tabs still running the previous web version show an error until they reload.

## Out of scope and follow-ups

- **`GET /suites` stays unbounded.** It returns the full array with cases, ordered by `isDefault` and `createdAt` descending. The project chat uses it and needs every case, and so does the new run form, which reads only `id` and `name`. Follow-ups: server-side case search for the chat and a searchable selector for the new run. Paginating `GET /suites` would break the contract of its clients.
- **The same relation count in the chat.** `apps/api/src/modules/chat/chat.service.ts:977` uses `_count: { select: { cases: true } }` and reads `suite._count.cases` at line 998, so it scans all of `test_case` the way the list used to. Follow-up: replace it with a scoped `groupBy`.
- **No total.** The paged response carries no suite total.

## What automated tests do not cover

Ordering, filters, the cursor, and the derivation are pure functions with unit tests. The SQL reads (the LATERAL query and the `groupBy`) are tested for their shape and bound values against a mocked Prisma, because no API suite uses a real database. The measurement above checked their execution plan once.

| Contract | Tests |
|---|---|
| Derivation, ordering, search, and facet | `packages/types/src/suite-run-status.test.ts` and `suite-summaries.test.ts` |
| Cursor, pipeline, and reads | `apps/api/src/modules/suites/lib/*.spec.ts` and `suite-list-query.service.spec.ts` |
| Routes, validation, and registration order | `apps/api/test/suite-list.e2e-spec.ts` |
| Retirement of the metrics route | `apps/api/test/runs-queries.e2e-spec.ts` |
| List, focus, announcements, and cache | `apps/web/src/features/projects/suites/test/` |

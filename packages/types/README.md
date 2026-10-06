# @qably/types

Shared TypeScript domain interfaces, status unions, and API contracts consumed by `apps/api`, `apps/web`, and workspace packages.

## Overview

This package keeps type consistency across the application boundary. The record and view shapes defined here are what `apps/api` returns and `apps/web` consumes. Request validation schemas stay in `apps/api`, and the package has no runtime dependencies. A few pure helpers that both apps need live here too (see Shared Logic).

## Exported Types

### Status Definitions

- `CaseStatus`: Possible verdicts for a test case (`pass`, `fail`, `skip`, `blocked`, `running`, `pending`).
- `RunStatus`: Overall execution status of a test run (`pass`, `fail`, `running`, `pending`).
- `ProposalStatus`: Triage state of an extracted test case proposal (`in_review`, `approved`, `rejected`, `changes_requested`).
- `ReviewStatus`: The `reviewStatus` of an `AiCase` (`pending`, `confirmed`, `rejected`).
- `CasePriority`: Urgency classification (`critical`, `high`, `medium`, `low`).
- `CaseState`: Lifecycle of a test case (`active`, `draft`, `deprecated`).
- `ExecutionMode`: Origin of test execution (`manual`, `automated`).
- `RunSource`: Where a run came from (`manual`, `api`, `github_actions`).
- `SuiteRunStatus`: Aggregated suite health indicator (`running`, `pass`, `fail`, `needs-attention`, `never-run`).
- `CiRunStatus`: Status of a CI run (`failing`, `passing`).

### Entity Contracts

- `OrgMember`: Organization user profile with access role (`owner`, `admin`, `member`).
- `ApiKey` and `ApiKeyWithSecret`: Project-level ingestion tokens with masked and plaintext secret variants.
- `Project`: Project metadata, technologies, and the linked repository connection.
- `Suite`: Test suite container organizing individual test cases, with documentation state and open collision count.
- `TestCase` and `TestCaseVersion`: Test definitions, execution steps, expected outcomes, and published revisions.
- `RunRecord` and `RunCaseRecord`: A run with its per-case results and its regression and fix delta. `RunSummaryRecord` and `RunsPageRecord` are the list shapes.
- `CiRunSummaryRecord`, `CiRunDetailRecord`, and `CiRunsPageRecord`: CI runs that group the suite runs of one CI execution.
- `SuiteSummary`, `SuiteSummariesPage`, and `SuiteTagsFacet`: Row, page, and tag facet of the keyset-paginated suite list.
- `ExtractedProposal`, `ReviewDecision`, and `OfficialTestCase`: Proposals from AI extraction, the decisions on them, and the published case.

### Response and Event Payloads

- `JunitIngestRecord`: Response of the JUnit ingest endpoint: queued runs, rejected suite groups, case identity collisions, and truncated field counts.
- `DashboardOverviewRecord`, `DashboardChannelsRecord`, `DashboardSummaryRecord`, and `TraceabilityCalendarRecord`: Dashboard endpoint responses.
- `ChatThreadRecord`, `ChatThreadDetailRecord`, and `ChatMessageRecord`: Project chat threads and messages, including attached cases and grounding.
- `NotificationEventType`: Trigger events for notifications (`run_failed`, `run_completed`, `case_regressed`, `ingestion_failed`, `connection_security`). `NotificationChannel` lists the delivery channels (`in_app`, `email`, `slack`, `discord`).

## Shared Logic

- `deriveSuiteRunStatus(oldestFirst)`: Derives a suite's `SuiteRunStatus` and `recentPassRate` from its run statuses, oldest first. It looks at the last `SUITE_RUN_WINDOW` (10) runs. A running run in the window gives `running`, an empty window gives `never-run`, and no completed run or a pass rate over completed runs below `SUITE_PASS_RATE_THRESHOLD` (70) gives `needs-attention`. Otherwise the latest completed run decides `pass` or `fail`.
- `computePassRate(counts)`, `countDecided(counts)`, and `computePassRateTrend(current, previous)`: Pass rate is `pass / (pass + fail + blocked)` and is `null` when no case is decided.
- `SUITE_SUMMARY_SORTS`, `SUITE_RUN_STATUSES`, `suiteSortKey`, `compareSuiteSortKeys`, `matchesSuiteSearch`, and `collectSuiteTags`: Sort keys, ordering, search matching, and tag collection for suite summaries.
- `assessCaseDocumentation` and `assessSuiteDocumentation`: Report which documentation fields are missing on a case or a suite.
- `PLAN_LIMITS`, `publicPlanLimits`, `monthStartUtc`, `nextMonthStartUtc`, and `creditsUsedAt`: Per-plan limits and the monthly AI credit period helpers.
- `DASHBOARD_PERIODS` (`7`, `30`, `90`) and `isDashboardPeriod`: The dashboard period selector values.
- `matchDeclaredTestPattern(filePath, patterns)` and `isSafeRepoRelativePath(path)`: Test file pattern matching and repository-relative path validation.
- `DEFAULT_NOTIFICATION_PREFERENCES`, `MAX_ATTACHED_CASES`, and `ASSISTANT_MODEL_NAME`: Shared constants.

## Available Scripts

Run scripts from this directory or from the root workspace using `pnpm --filter @qably/types <command>`.

### Build

Compile TypeScript source files to declaration files and JavaScript bundles in `dist/`:

```bash
pnpm run build
```

The package entry points (`main`, `types`, `exports`) resolve to `dist/`, so a change under `src/` reaches the apps only after this build runs.

### Type Checking

Verify typing without emitting build files:

```bash
pnpm run type-check
```

### Testing

Run the unit tests for the shared helpers:

```bash
pnpm run test
```

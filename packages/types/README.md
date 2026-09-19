# @qably/types

Shared TypeScript domain interfaces, status unions, and API contracts consumed by `apps/api`, `apps/web`, and workspace packages.

## Overview

This package guarantees type consistency across application boundaries. The contracts defined here represent the single source of truth for database entities, HTTP endpoints, and queue messages.

## Exported Types

### Status Definitions

- `CaseStatus`: Possible verdicts for a test case (`pass`, `fail`, `skip`, `blocked`, `running`, `pending`).
- `RunStatus`: Overall execution status of a test run (`pass`, `fail`, `running`, `pending`).
- `ReviewStatus`: Triage state for AI-generated test proposals (`pending`, `confirmed`, `rejected`).
- `CasePriority`: Urgency classification (`critical`, `high`, `medium`, `low`).
- `ExecutionMode`: Origin of test execution (`manual`, `automated`).
- `SuiteRunStatus`: Aggregated suite health indicator (`running`, `pass`, `fail`, `needs-attention`, `never-run`).

### Entity Contracts

- `OrgMember`: Organization user profile with access role (`owner`, `admin`, `member`).
- `ApiKey` and `ApiKeyWithSecret`: Project-level ingestion tokens with masked and plaintext secret variants.
- `Project`: Project metadata, slug, and source repository associations.
- `Suite`: Test suite container organizing individual test cases.
- `TestCase` and `TestCaseVersion`: Detailed test definitions, execution steps, expected outcomes, and revision histories.
- `TestRun`: Execution session tracking passed, failed, and skipped test counts.

### Integration and Queue Payloads

- `RunIngestPayload`: Schema for JSON test result submissions sent by CI pipelines.
- `JUnitReport` and `JUnitTestCase`: Parsed structures for JUnit XML ingestion.
- `NotificationEventType`: Trigger events for email, Discord, and Slack notifications.

## Available Scripts

Run scripts from this directory or from the root workspace using `pnpm --filter @qably/types <command>`.

### Build

Compile TypeScript source files to declaration files and JavaScript bundles in `dist/`:

```bash
pnpm run build
```

### Type Checking

Verify typing without emitting build files:

```bash
pnpm run type-check
```

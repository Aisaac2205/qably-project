import { API_BASE_URL_TOKEN, type DocContent } from './types';

export const en: DocContent = {
  pageTitle: 'Documentation | Qably',
  pageDescription:
    'Guide to connecting repositories, generating API keys, and sending CI test results to Qably based on the public API contract.',
  breadcrumbLabel: 'Integration guide',
  tocLabel: 'Table of contents',
  heroTitle: 'Documentation',
  heroSubtitle:
    'Technical reference for the public Qably API, covering available endpoints, payload schemas, and integration flows.',
  copyCodeLabel: 'Copy code',
  copiedLabel: 'Copied!',
  navGroups: [
    { label: 'Getting started', sectionIds: ['getting-started'] },
    {
      label: 'Setup guide',
      sectionIds: [
        'step-1-create-project',
        'step-2-connect-repository',
        'step-3-api-key',
        'step-4-report-ci',
        'step-5-verify',
      ],
    },
    { label: 'Other languages', sectionIds: ['other-languages'] },
    { label: 'Best practices', sectionIds: ['naming-tests'] },
    {
      label: 'Reference',
      sectionIds: [
        'reference-runs-ingest',
        'reference-runs-ingest-junit',
        'reference-webhook',
        'reference-api-keys',
        'reference-env-vars',
      ],
    },
    { label: 'Notifications', sectionIds: ['notifications-discord-slack'] },
    { label: 'Help', sectionIds: ['faq'] },
  ],
  sections: [
    {
      id: 'getting-started',
      navLabel: 'Getting started',
      title: 'Getting started',
      blocks: [
        {
          type: 'paragraph',
          text: 'Qably centralizes QA tracking for engineering teams. The platform does not execute tests directly. Instead, external CI pipelines run the test suites and push results to Qably over HTTP. Qably stores the incoming data and provides a single view of test history, repository changes, and coverage status.',
        },
        { type: 'subheading', text: 'Two independent pipelines' },
        {
          type: 'paragraph',
          text: 'Qably operates two decoupled data pipelines. Setting up one pipeline does not configure the other, which is the most frequent reason a screen appears empty.',
        },
        {
          type: 'table',
          headers: ['Pipeline', 'Endpoint', 'Credential', 'Fills'],
          rows: [
            [
              'Test results',
              'POST /runs/ingest',
              'Project API key in Authorization: Bearer',
              'Suites, cases, and runs shown on the main dashboard',
            ],
            [
              'Code changes',
              'POST /webhooks/scm/:provider',
              'HMAC signature (no API key)',
              'Code changes, ingestion batches, and traceability on the Repository page',
            ],
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'A CI reporter sending test results never populates the Repository page, and connecting a repository never records test runs. If a screen shows no data, verify which pipeline feeds that specific view.',
        },
        { type: 'subheading', text: 'Prerequisites' },
        {
          type: 'list',
          items: [
            'A Qably account with at least one active organization.',
            'A repository hosted on GitHub or Bitbucket (the two currently supported providers).',
            'A CI pipeline capable of running tests and making HTTP requests upon completion.',
          ],
        },
      ],
    },
    {
      id: 'step-1-create-project',
      navLabel: '1. Create the project',
      title: '1. Create the project',
      blocks: [
        {
          type: 'paragraph',
          text: 'Every project belongs to an organization. Create one by navigating to Projects > New project in the web app.',
        },
        {
          type: 'list',
          items: [
            'Name (required, up to 80 characters)',
            'Description (optional, up to 500 characters)',
            'Technologies (optional, populated automatically when connecting a repository in the next step)',
          ],
        },
        {
          type: 'paragraph',
          text: 'A connected repository is not required to create a project. Linking a repository, generating an API key, and configuring CI reporting operate independently and can be completed in any order.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'A newly created project initializes with empty suites, no runs, and an unconnected repository status until it receives its first payload.',
        },
      ],
    },
    {
      id: 'step-2-connect-repository',
      navLabel: '2. Connect repository',
      title: '2. Connect repository via SCM webhook',
      blocks: [
        {
          type: 'paragraph',
          text: 'This step activates the code change pipeline. Qably receives repository updates through webhooks sent by your Git host, completely independent of the project API key in step 3.',
        },
        { type: 'subheading', text: 'Repository selection' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Sign in with GitHub or Bitbucket if you have not done so already. Qably uses this OAuth token to query accessible repositories across personal accounts and organizations.',
            'In project settings under Integrations, select the target repository from the list, sorted by most recent push.',
            'Selecting an unlinked repository creates an organization connection and generates a webhook secret. Selecting an already connected repository reuses its existing connection.',
          ],
        },
        { type: 'subheading', text: 'Registering the webhook with the provider' },
        {
          type: 'paragraph',
          text: 'Qably does not register webhooks automatically on external hosts. Add the webhook manually in repository settings.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Retrieve the secret by calling POST /connections/:id/webhook-secret from connection settings. The response outputs the raw secret once upon creation or rotation, so copy it immediately.',
            'In GitHub, navigate to Settings > Webhooks > Add webhook within the repository.',
            `Payload URL: ${API_BASE_URL_TOKEN}/webhooks/scm/github`,
            'Content type: application/json',
            'Secret: the value generated in the previous step',
            'Events: select push at a minimum. Enable pull request events as well to capture complete branch activity.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Qably validates every incoming payload against the secret using HMAC-SHA256 signatures (x-hub-signature-256 header in sha256=<hex> format). Missing or mismatched signatures are rejected with HTTP 401.',
        },
        {
          type: 'paragraph',
          text: 'Bitbucket connections operate identically, using Bitbucket-specific signature headers. GitHub and Bitbucket are the two supported repository providers.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Successful deliveries appear in your provider webhook delivery logs. In Qably, the updated ingestion batch, commits, and file diffs populate after the next push or pull request.',
        },
      ],
    },
    {
      id: 'step-3-api-key',
      navLabel: '3. Issue an API key',
      title: '3. Issue an API key',
      blocks: [
        {
          type: 'paragraph',
          text: 'This step configures the test results pipeline, supplying machine credentials so CI jobs can push test data without an interactive user session.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Under project API Keys settings, create a key with an identifying name like "CI/CD Pipeline". This requires owner or admin permissions within the organization.',
            'The generated token follows the format qbly_<lookupId>_<secret> and appears only once in the confirmation dialog. Qably stores solely its SHA-256 hash and cannot display it again.',
            'Store the value in your CI provider. In GitHub Actions, navigate to Settings > Secrets and variables > Actions > Secrets and create the QABLY_API_KEY repository secret. If using a custom URL, add the QABLY_API_BASE_URL variable under the Variables tab. Never commit plaintext tokens to source control.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Each API key is scoped strictly to a single project and only holds permissions to post test runs. It cannot read other projects, list suites, or modify organization configuration. The target project is determined directly from the key.',
        },
        {
          type: 'paragraph',
          text: 'Revoking a key disables future requests immediately while preserving all historical runs linked to it. Projects can hold multiple active keys concurrently, allowing smooth key rotation without CI downtime.',
        },
      ],
    },
    {
      id: 'step-4-report-ci',
      navLabel: '4. Report results from CI',
      title: '4. Report results from CI',
      blocks: [
        {
          type: 'paragraph',
          text: 'To connect Qably to your continuous integration pipeline, create a workflow file in your repository (such as .github/workflows/ci.yml). The YAML syntax structures the pipeline through on trigger events, runner environments under jobs, and an ordered sequence of commands in steps to prepare the runner, execute tests, and send the report.',
        },
        {
          type: 'paragraph',
          text: 'For Jest, add jest-junit and set JEST_JUNIT_ADD_FILE_ATTRIBUTE to "true" so the XML includes source file paths for each test case, enabling Qably to map tests to code. In Vitest, JUnit reports are generated natively by specifying the reporter flag on the command line.',
        },
        {
          type: 'codeGroup',
          label: 'GitHub Actions workflow (.github/workflows/ci.yml)',
          variants: [
            {
              language: 'yaml',
              label: 'Jest',
              code: `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Run tests and report to Qably
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Run Jest tests
        env:
          JEST_JUNIT_OUTPUT_DIR: ./reports
          JEST_JUNIT_OUTPUT_NAME: junit.xml
          JEST_JUNIT_ADD_FILE_ATTRIBUTE: 'true'
        run: npx jest --ci --reporters=default --reporters=jest-junit

      - name: Report results to Qably
        if: always()
        env:
          QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
        run: |
          curl --fail --silent --request POST \\
            "${API_BASE_URL_TOKEN}/runs/ingest/junit?externalId=gha-\${{ github.run_id }}-\${{ github.job }}&source=github_actions" \\
            --header "Authorization: Bearer $QABLY_API_KEY" \\
            --header "Content-Type: application/xml" \\
            --data-binary @./reports/junit.xml || true`,
            },
            {
              language: 'yaml',
              label: 'Vitest',
              code: `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Run tests and report to Qably
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Run Vitest tests
        run: npx vitest run --reporter=default --reporter=junit --outputFile=./reports/junit.xml

      - name: Report results to Qably
        if: always()
        env:
          QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
        run: |
          curl --fail --silent --request POST \\
            "${API_BASE_URL_TOKEN}/runs/ingest/junit?externalId=gha-\${{ github.run_id }}-\${{ github.job }}&source=github_actions" \\
            --header "Authorization: Bearer $QABLY_API_KEY" \\
            --header "Content-Type: application/xml" \\
            --data-binary @./reports/junit.xml || true`,
            },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'The if: always() condition on the reporting step is required to guarantee delivery even when tests fail. CI build failures should reflect failing test assertions rather than being disrupted by telemetry transmission.',
        },
        {
          type: 'paragraph',
          text: 'The POST /runs/ingest/junit endpoint receives raw XML and handles parsing server-side. Unrecognized suites or cases are provisioned automatically within that project.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'The externalId parameter ensures idempotency across CI retries. Linking it to runner execution identifiers (such as github.run_id and github.job) ensures re-running a failed job in GitHub Actions updates the existing run rather than creating duplicate entries.',
        },
      ],
    },
    {
      id: 'step-5-verify',
      navLabel: '5. Verify the data arrived',
      title: '5. Verify the data arrived',
      blocks: [
        {
          type: 'paragraph',
          text: 'Verify each pipeline separately, as one may function correctly while the other requires troubleshooting.',
        },
        {
          type: 'list',
          items: [
            'Test results: open the project and locate the run submitted by CI. Overall run status is derived from individual test cases: any failing test fails the run; pending or executing tests keep it in progress; and it passes once at least one test passes or skips with no failures.',
            'Code changes: requires completing step 2. The Repository tab should display an ingestion batch matching the latest push or pull request.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'If expected data does not appear, check the FAQ section below for common issues such as unregistered webhooks or missing CI environment variables.',
        },
      ],
    },
    {
      id: 'other-languages',
      navLabel: 'JUnit XML from any language',
      title: 'Reporting JUnit XML from any language',
      blocks: [
        {
          type: 'paragraph',
          text: 'Qably parses any report following the standard <testsuite>/<testcase> structure, deriving test status from <failure>, <error>, or <skipped> elements. Generate the XML file using your framework tooling and transmit it to Qably in your CI pipeline.',
        },
        { type: 'subheading', text: 'JavaScript and TypeScript' },
        {
          type: 'paragraph',
          text: 'Jest and Vitest are covered in the previous step and share the same configuration.',
        },
        {
          type: 'codeGroup',
          label: 'Reporting JUnit XML from any language',
          variants: [
            {
              language: 'shell',
              label: 'Playwright',
              code: 'PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml npx playwright test --reporter=junit',
            },
            {
              language: 'shell',
              label: 'pytest',
              code: 'pytest --junitxml=report.xml',
            },
            {
              language: 'shell',
              label: 'Java (Maven Surefire)',
              code: `mvn test
# generates target/surefire-reports/TEST-*.xml`,
            },
            {
              language: 'shell',
              label: 'Java (Gradle)',
              code: `./gradlew test
# generates build/test-results/test/TEST-*.xml`,
            },
            {
              language: 'shell',
              label: 'PHPUnit 9 and earlier',
              code: 'phpunit --log-junit junit.xml',
            },
            {
              language: 'shell',
              label: 'PHPUnit 10+',
              code: 'phpunit -c phpunit.xml',
            },
            {
              language: 'shell',
              label: '.NET',
              code: 'dotnet test --logger:"junit;LogFilePath=test-result.xml"',
            },
            {
              language: 'shell',
              label: 'Go',
              code: 'go test -v ./... 2>&1 | go-junit-report > report.xml',
            },
          ],
        },
        {
          type: 'paragraph',
          text: "Playwright's built-in JUnit reporter writes to standard output unless a file is specified, either through an environment variable or the config file.",
        },
        {
          type: 'paragraph',
          text: "It can also be configured once in playwright.config.ts: reporter: [['junit', { outputFile: 'results.xml' }]].",
        },
        {
          type: 'paragraph',
          text: 'mvn test writes one report per test class with no extra flag; the Surefire plugin does this by default.',
        },
        {
          type: 'paragraph',
          text: 'PHPUnit 9 and earlier accept a direct CLI flag. PHPUnit 10 and later removed it, so the output file is configured in phpunit.xml instead.',
        },
        {
          type: 'paragraph',
          text: 'The JunitXml.TestLogger NuGet package is added as a dependency, and the logger is passed on the command line.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'Verify the suggested go-junit-report command against the tool official repository before running it in production workflows.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'Case identity within a suite is determined strictly by the name attribute of the <testcase> element; classname is ignored. Two tests named test_login across different classes will resolve to the same test case in Qably.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'pytest generates a single <testsuite name="pytest"> block for the entire test session, unlike Jest and Vitest, which emit one suite per file. As a result, all pytest executions map to a single suite in Qably by default. To achieve per-file granularity, configure junit_suite_name in your pytest settings or split the run across multiple commands.',
        },
      ],
    },
    {
      id: 'naming-tests',
      navLabel: 'Naming tests',
      title: 'Naming tests for Qably',
      blocks: [
        {
          type: 'paragraph',
          text: 'Qably derives test and suite names directly from your test runner output and file paths. The labels defined in your test code appear across the platform, turning test names into clear technical documentation for the entire team.',
        },
        {
          type: 'paragraph',
          text: 'These four conventions help produce clean, readable test suites:',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Group tests by business feature rather than technical classes or file paths. Describe what the user does (such as "Shopping cart" instead of "CartServiceImpl").',
            'Write test titles as an active verb combined with the expected condition: "rejects an empty token", "accepts a token up to 500 characters".',
            'Isolate one behavior per test. A test title containing the word "and" usually indicates two separate assertions that should be split.',
            'Name the test file after the feature under test, since this value determines the suite title in Qably.',
          ],
        },
        {
          type: 'subheading',
          text: 'Automatic name formatting',
        },
        {
          type: 'paragraph',
          text: 'During ingestion, Qably converts technical identifiers into readable text by splitting camelCase or snake_case strings and stripping scaffolding prefixes like "test", "spec", or "case". A function name such as testTokenNull appears in the UI as "Token null".',
        },
        {
          type: 'paragraph',
          text: 'When a test name is already written as a full phrase (for example, "should reject an empty token"), Qably preserves the phrasing and capitalizes only the first letter without modifying verbs or dropping words.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Qably does not translate test names. The technical identifier serves as the join key between the repository and execution history. When teams write code in English and use Qably in Spanish, localization belongs in case documentation rather than technical identifiers.',
        },
        {
          type: 'subheading',
          text: 'A before and after',
        },
        {
          type: 'table',
          headers: ['Instead of', 'Write'],
          rows: [
            ['test_login_1', 'signs in with valid credentials'],
            ['testTokenNull', 'rejects an empty token'],
            ['should return 400 when body is invalid and user is anonymous', 'rejects a request with an invalid body'],
            ['UserServiceTest.java', 'user-registration'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Existing test suites do not require renaming before onboarding. Qably imports current titles as-is and preserves manual edits made in the UI across subsequent ingestion runs.',
        },
      ],
    },
    {
      id: 'reference-runs-ingest',
      navLabel: 'POST /runs/ingest',
      title: 'Reference: POST /runs/ingest',
      blocks: [
        {
          type: 'paragraph',
          text: 'Ingests execution results for a test suite. Authenticate using Authorization: Bearer <project API key>. The target project and organization are resolved directly from the key.',
        },
        {
          type: 'codeGroup',
          label: 'POST /runs/ingest',
          variants: [
            {
              language: 'shell',
              label: 'cURL',
              code: `curl --fail --silent \\
  --request POST \\
  "${API_BASE_URL_TOKEN}/runs/ingest" \\
  --header "Authorization: Bearer $QABLY_API_KEY" \\
  --header "Content-Type: application/json" \\
  --data '{
    "externalId": "gh-run-482913",
    "source": "github_actions",
    "suiteId": "suite_123",
    "name": "Checkout regression - main",
    "startedAt": "2026-09-01T10:00:00Z",
    "finishedAt": "2026-09-01T10:04:12Z",
    "commitSha": "a1b2c3d",
    "commitMessage": "fix: checkout rounding",
    "commitAuthor": "Ada Lovelace",
    "cases": [
      { "name": "Adds an item to the cart", "status": "pass" },
      {
        "name": "Applies a discount code",
        "steps": ["open cart", "apply code SAVE10"],
        "expectedResult": "total is reduced by 10%",
        "status": "fail"
      }
    ]
  }'`,
            },
            {
              language: 'typescript',
              label: 'Node',
              code: `const response = await fetch('${API_BASE_URL_TOKEN}/runs/ingest', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.QABLY_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    externalId: 'gh-run-482913',
    source: 'github_actions',
    suiteId: 'suite_123',
    name: 'Checkout regression - main',
    startedAt: '2026-09-01T10:00:00Z',
    finishedAt: '2026-09-01T10:04:12Z',
    commitSha: 'a1b2c3d',
    commitMessage: 'fix: checkout rounding',
    commitAuthor: 'Ada Lovelace',
    cases: [
      { name: 'Adds an item to the cart', status: 'pass' },
      {
        name: 'Applies a discount code',
        steps: ['open cart', 'apply code SAVE10'],
        expectedResult: 'total is reduced by 10%',
        status: 'fail',
      },
    ],
  }),
});`,
            },
            {
              language: 'python',
              label: 'Python',
              code: `import os
import requests

response = requests.post(
    "${API_BASE_URL_TOKEN}/runs/ingest",
    headers={"Authorization": f"Bearer {os.environ['QABLY_API_KEY']}"},
    json={
        "externalId": "gh-run-482913",
        "source": "github_actions",
        "suiteId": "suite_123",
        "name": "Checkout regression - main",
        "startedAt": "2026-09-01T10:00:00Z",
        "finishedAt": "2026-09-01T10:04:12Z",
        "commitSha": "a1b2c3d",
        "commitMessage": "fix: checkout rounding",
        "commitAuthor": "Ada Lovelace",
        "cases": [
            {"name": "Adds an item to the cart", "status": "pass"},
            {
                "name": "Applies a discount code",
                "steps": ["open cart", "apply code SAVE10"],
                "expectedResult": "total is reduced by 10%",
                "status": "fail",
            },
        ],
    },
)
response.raise_for_status()`,
            },
          ],
        },
        {
          type: 'table',
          headers: ['Field', 'Required', 'Notes'],
          rows: [
            ['externalId', 'yes', 'Non-empty string. Idempotency key used to update existing records instead of creating duplicates.'],
            ['source', 'no', '"api" (default) or "github_actions".'],
            ['suiteId / suiteName', 'exactly one', 'An unresolvable suiteId returns 404. An unresolvable suiteName registers the suite automatically.'],
            ['name', 'yes', 'Display name for the test run, up to 200 characters.'],
            ['startedAt / finishedAt', 'no', 'ISO 8601 timestamps with explicit time zone offset.'],
            ['commitSha / commitMessage / commitAuthor', 'no', 'Optional commit metadata, up to 64, 2000, and 200 characters respectively.'],
            ['cases', 'yes', 'Array containing at least one test case.'],
          ],
        },
        {
          type: 'table',
          headers: ['Case field', 'Required', 'Notes'],
          rows: [
            ['name', 'yes', 'Up to 120 characters.'],
            ['suiteName', 'no', 'Defaults to the resolved suite name; allows attaching auxiliary labels (such as Playwright project names) for audit trails.'],
            ['steps', 'no', 'Array of strings, up to 50 items (500 characters max each). Empty by default on JUnit imports; can be populated when posting JSON directly.'],
            ['expectedResult', 'no', 'Up to 1000 characters. Empty by default on JUnit imports.'],
            ['status', 'yes', 'One of pending, running, pass, fail, skip, blocked.'],
            ['recordedAt', 'no', 'ISO 8601 timestamp with explicit time zone offset.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Run status is determined on the server and does not trust client-calculated summaries. A single failing case marks the entire run as failed. Unresolved pending or running cases maintain the run in an executing state. A run passes only when at least one case passes or is skipped with no accompanying failures. Runs where all cases are blocked count as failed because no verifications took place.',
        },
        {
          type: 'paragraph',
          text: 'Submitting matching (project, source, externalId) tuples updates the existing run instead of duplicating records. The case list is replaced entirely, and optional metadata fields are updated when provided in subsequent payloads. The API responds with 200 OK on both initial creation and replays.',
        },
      ],
    },
    {
      id: 'reference-runs-ingest-junit',
      navLabel: 'POST /runs/ingest/junit',
      title: 'Reference: POST /runs/ingest/junit',
      blocks: [
        {
          type: 'paragraph',
          text: 'Allows submitting raw JUnit XML reports directly for server-side parsing. Shares identical authentication requirements with POST /runs/ingest.',
        },
        {
          type: 'paragraph',
          text: 'The request body carries raw XML with Content-Type set to application/xml or text/xml (up to 10 MB). Additional run parameters are passed as query string arguments.',
        },
        {
          type: 'table',
          headers: ['Query parameter', 'Required', 'Notes'],
          rows: [
            ['externalId', 'yes', 'Idempotency key identical to POST /runs/ingest.'],
            ['source', 'no', '"api" (default) or "github_actions".'],
            ['suiteId / suiteName', 'no', 'Same resolution rules as the JSON endpoint. When omitted, suite name defaults to the <testsuite name="..."> attribute.'],
            ['name', 'no', 'Defaults to the suite name when omitted.'],
            ['startedAt / finishedAt / commitSha / commitMessage / commitAuthor', 'no', 'Same fields supported by POST /runs/ingest.'],
          ],
        },
        {
          type: 'code',
          language: 'shell',
          code: `curl --fail --silent \\
  --request POST \\
  "${API_BASE_URL_TOKEN}/runs/ingest/junit?externalId=ci-42" \\
  --header "Authorization: Bearer $QABLY_API_KEY" \\
  --header "Content-Type: application/xml" \\
  --data-binary @junit.xml`,
        },
        {
          type: 'paragraph',
          text: 'Case titles are extracted from the <testcase name="..."> attribute; classname is consulted only as a fallback when name is omitted. Malformed XML or empty bodies return HTTP 400.',
        },
      ],
    },
    {
      id: 'reference-webhook',
      navLabel: 'POST /webhooks/scm/:provider',
      title: 'Reference: POST /webhooks/scm/:provider',
      blocks: [
        {
          type: 'paragraph',
          text: 'The :provider route parameter accepts github or bitbucket (case-insensitive). This route does not use API keys: incoming payloads are authenticated against the HMAC secret configured for the repository connection.',
        },
        {
          type: 'table',
          headers: ['', 'GitHub', 'Bitbucket'],
          rows: [
            ['Signature header', 'x-hub-signature-256 (format sha256=<hex>)', 'x-hub-signature (format sha256=<hex>)'],
            ['Event header', 'x-github-event: push or pull_request', 'x-event-key: repo:push, pullrequest:created, or pullrequest:updated'],
            ['Delivery id header', 'x-github-delivery', 'x-request-uuid'],
            ['Pull request actions handled', 'opened, synchronize', 'created, updated'],
          ],
        },
        {
          type: 'table',
          headers: ['Response', 'Meaning'],
          rows: [
            ['202, { "status": "accepted" }', 'Valid signature. Event stored and queued for processing.'],
            ['202, { "status": "duplicate" }', 'The (provider, delivery id) tuple was already processed. Replays are idempotent.'],
            ['202, { "status": "ignored" }', 'Valid signature for an event type Qably does not ingest.'],
            ['404', 'Unsupported provider in route.'],
            ['401', 'HMAC verification failed against all configured repository connections.'],
            ['400', 'Malformed request body or invalid JSON.']
          ],
        },
        {
          type: 'paragraph',
          text: 'Rate limited to 60 requests per minute per instance. Accepted events queue and process asynchronously. The HTTP response acknowledges receipt of the payload rather than completed processing.',
        },
        {
          type: 'subheading',
          text: 'Rotating the secret',
        },
        {
          type: 'paragraph',
          text: 'Each connection holds its own HMAC secret. If the secret configured on the Git provider falls out of sync with Qably, deliveries fail with HTTP 401. Rotating the secret generates a fresh token, persists its encrypted value, and displays the raw string once.',
        },
        {
          type: 'table',
          headers: ['Action', 'Endpoint', 'Required role'],
          rows: [
            ['Rotate the webhook secret', 'POST /projects/:projectId/repository/webhook-secret', 'owner or admin'],
          ],
        },
        {
          type: 'paragraph',
          text: 'The 201 response returns { "webhookSecret": "<64 hexadecimal characters>" }. Copy this string into your repository webhook configuration before closing the dialog. The former secret is invalidated immediately. Calling this endpoint on a project without a linked repository returns 404.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'Secret rotation is also accessible from the Repository tab in project settings. Payloads delivered between secret generation and updating the provider will fail with 401 and should be redelivered from your Git host webhook logs.',
        },
      ],
    },
    {
      id: 'reference-api-keys',
      navLabel: 'API keys',
      title: 'Reference: API keys',
      blocks: [
        {
          type: 'paragraph',
          text: 'API keys use the format qbly_<lookupId>_<secret>. They consist of a fixed prefix, a public 6-byte lookup ID, and a 32-byte secret token. Qably stores only the SHA-256 hash and performs constant-time comparisons. The plaintext token cannot be retrieved once issued.',
        },
        {
          type: 'table',
          headers: ['Action', 'Endpoint', 'Role required'],
          rows: [
            ['List keys', 'GET /projects/:projectId/api-keys', 'Any organization member'],
            ['Create a key', 'POST /projects/:projectId/api-keys (body: { "name": string })', 'owner or admin'],
            ['Revoke a key', 'POST /projects/:projectId/api-keys/:id/revoke', 'owner or admin'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Revoked keys are preserved in the database to maintain attribution for past test runs. Transmit the key via Authorization: Bearer qbly_<lookupId>_<secret>.',
        },
      ],
    },
    {
      id: 'reference-env-vars',
      navLabel: 'Environment variables',
      title: 'Reference: environment variables',
      blocks: [
        {
          type: 'paragraph',
          text: "Environment variables configured in CI pipelines to integrate with Qably:",
        },
        {
          type: 'table',
          headers: ['Variable', 'Required', 'Notes'],
          rows: [
            ['QABLY_API_KEY', 'yes (to submit data)', 'Project authentication key in CI. Unauthenticated requests return HTTP 401.'],
            ['QABLY_API_BASE_URL', 'no', `Defaults to ${API_BASE_URL_TOKEN}. Override for self-hosted instances or local testing against http://localhost:3001.`],
          ],
        },
      ],
    },
    {
      id: 'notifications-discord-slack',
      navLabel: 'Discord & Slack',
      title: 'Notify Discord or Slack',
      blocks: [
        {
          type: 'paragraph',
          text: 'Qably dispatches notifications to Discord channels or Slack workspaces for failed or passed test runs, case regressions, ingestion failures, and credential updates. Webhooks are provisioned on Discord or Slack; Qably delivers outgoing notifications to the configured endpoint URL.',
        },
        {
          type: 'logoRow',
          items: [
            { src: '/tech-icons/discord.svg', alt: 'Discord logo', label: 'Discord' },
            { src: '/tech-icons/slack.svg', alt: 'Slack logo', label: 'Slack' },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'If a webhook is deleted or regenerated in Discord or Slack, notification deliveries fail until the channel URL is updated or removed in project settings.',
        },
        { type: 'subheading', text: 'Get a webhook URL from Discord' },
        {
          type: 'list',
          ordered: true,
          items: [
            'In the destination Discord server, navigate to Server Settings > Integrations > Webhooks.',
            'Click New Webhook, select the target channel, and copy the webhook URL.',
          ],
        },
        { type: 'subheading', text: 'Get a webhook URL from Slack' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Create or select a Slack application at api.slack.com/apps and enable Incoming Webhooks.',
            'Install the app to your workspace, select the channel, and copy the generated webhook URL.',
          ],
        },
        { type: 'subheading', text: 'Connect it to Qably' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Under Settings > Integrations in Team notification channels, select Add channel.',
            'Choose Discord or Slack, provide a channel name, paste the webhook URL, and select desired event triggers.',
            'Use the send-test action to confirm message delivery before relying on the channel.',
          ],
        },
        {
          type: 'table',
          headers: ['Event', 'Fires when'],
          rows: [
            ['Run failed', 'A test run completes with at least one failing test.'],
            ['Run completed', 'A test run completes with all test cases passing.'],
            ['Case regressed', 'A previously passing test fails in the current run.'],
            ['Ingestion failed', 'An error occurs while ingesting repository code changes.'],
            ['Connection security', 'A repository webhook secret or connection credential is updated.'],
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Configuring notification channels requires owner or admin permissions in the organization. Once configured, connection security alerts can be read by anyone with access to the destination Discord channel or Slack workspace.',
        },
      ],
    },
    {
      id: 'faq',
      navLabel: 'Frequently asked questions',
      title: 'Frequently asked questions',
      blocks: [
        {
          type: 'faq',
          items: [
            {
              question: 'Why does my CI pipeline complete successfully, but no test runs appear in Qably?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Verify that the QABLY_API_KEY environment variable is defined as a repository secret for that CI job and that the reporting step executed. Using the if: always() condition ensures the upload runs even when tests fail.',
                },
                {
                  type: 'paragraph',
                  text: 'Confirm that your test runner generated the XML report at the specified file path before the upload step. If the curl command returns an HTTP error code (such as 401 for a revoked key or 400 for malformed XML), inspect the runner logs to determine the exact cause.',
                },
              ],
            },
            {
              question: 'How does Qably automatically create and organize test suites and cases?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'When importing a JUnit XML report, Qably inspects the XML attributes to identify each suite and test case. If a suite with that name does not already exist in the project, the server creates it immediately and assigns the test cases to it.',
                },
                {
                  type: 'paragraph',
                  text: 'You do not need to register tests in advance through the web interface or manage numerical identifiers. When posting JSON payloads directly to the API, pass the suiteName field so the system automatically matches or creates the suite.',
                },
              ],
            },
            {
              question: 'What happens in Qably if I retry a failed test job in CI?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Qably handles retries idempotently when you supply an externalId query parameter. Deriving this value from runner execution identifiers (such as the workflow run ID and job name in GitHub Actions) instructs the server to update the existing run instead of creating duplicate records.',
                },
                {
                  type: 'paragraph',
                  text: 'This ensures project pass rates and test metrics reflect the final status of the run without skewing historical analytics.',
                },
              ],
            },
            {
              question: 'Can I record individual test steps and expected results when uploading JUnit XML?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'The JUnit XML standard only records the final status of each test case (passed, failed, or skipped), its execution duration, and failure stack traces. For this reason, XML imports leave step definitions and expected outcomes empty.',
                },
                {
                  type: 'paragraph',
                  text: 'To track structured test procedures with individual steps and expected results, send JSON payloads directly to the POST /runs/ingest endpoint, or maintain structured test definitions within the web dashboard.',
                },
              ],
            },
            {
              question: 'Why are commits and branches missing from the project Repository section?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'The Repository view relies exclusively on the SCM webhook configured for your repository provider (GitHub or Bitbucket). Submitting test reports from CI populates execution history, but does not synchronize commit activity or branch metadata.',
                },
                {
                  type: 'paragraph',
                  text: 'To inspect code changes and link them with your test runs, configure the repository webhook using the payload URL and secret described in step 2.',
                },
              ],
            },
            {
              question: 'Can a single API key submit test results to multiple projects?',
              answer: [
                {
                  type: 'paragraph',
                  text: 'No. Each API key is scoped strictly to a single project within your organization. The server infers the target project directly from the token and restricts its permissions solely to test ingestion.',
                },
                {
                  type: 'paragraph',
                  text: 'For monorepos or multi-service architectures, generate a dedicated API key for each project and configure the corresponding secret in your CI workflows.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

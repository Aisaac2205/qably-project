import { API_BASE_URL_TOKEN, type DocContent } from './types';

export const en: DocContent = {
  pageTitle: 'Documentation — Qably',
  pageDescription:
    'How to connect a repository, issue an API key, and report CI test results to Qably — grounded in the actual API contract.',
  breadcrumbLabel: 'Integration guide',
  tocLabel: 'Table of contents',
  heroTitle: 'Documentation',
  heroSubtitle:
    'Everything here matches the API as it exists today. If a capability is not documented, it does not exist yet.',
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
    { label: 'Platform', sectionIds: ['platform-overview'] },
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
          text: 'Qably is a QA management platform for engineering teams. It does not run the tests; an external agent does that (the CI pipeline, today) and pushes the results to Qably over HTTP. Qably receives, stores, and provides one place to see what ran, what changed in the repository, and what still needs coverage.',
        },
        { type: 'subheading', text: 'Two independent pipelines' },
        {
          type: 'paragraph',
          text: 'Qably is fed by two pipelines that never depend on each other. Wiring one does not wire the other, and this is the single most common source of confusion when a screen looks empty.',
        },
        {
          type: 'table',
          headers: ['Pipeline', 'Endpoint', 'Credential', 'Fills'],
          rows: [
            [
              'Test results',
              'POST /runs/ingest',
              'Project API key, in Authorization: Bearer',
              'Suites, cases, and runs — what the dashboard shows',
            ],
            [
              'Code changes',
              'POST /webhooks/scm/:provider',
              'HMAC signature, no API key',
              "Code changes, ingestion batches, and evidence — what a project's Repository page shows",
            ],
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'A CI reporter that sends test results never populates the Repository page, and connecting a repository never reports a single test result. When a screen looks empty, it helps to check which pipeline is supposed to fill it; the FAQ at the end of this guide covers the most common causes.',
        },
        { type: 'subheading', text: 'Prerequisites' },
        {
          type: 'list',
          items: [
            'A Qably account with at least one organization',
            'A repository on GitHub or Bitbucket — the only two providers Qably supports today',
            'A CI pipeline that can run a script or send an HTTP request after the tests finish',
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
          text: 'Every project belongs to one organization and is created from Projects > New project in the web app.',
        },
        {
          type: 'list',
          items: [
            'Name — required, up to 80 characters',
            'Description — optional, up to 500 characters',
            'Technologies — optional; filled in automatically once a repository is connected, in the next step',
          ],
        },
        {
          type: 'paragraph',
          text: 'A repository is not required to create a project. Connecting one, issuing an API key, and reporting from CI are three independent steps, and they can be done in any order.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'The new project opens with empty suites, no runs, and a repository-not-connected notice. This is the expected behavior, since nothing has reported to it yet.',
        },
      ],
    },
    {
      id: 'step-2-connect-repository',
      navLabel: '2. Connect the repository',
      title: '2. Connect the repository via the SCM webhook',
      blocks: [
        {
          type: 'paragraph',
          text: 'This step wires the second pipeline. Code changes reach Qably through the webhook of the repository provider, and it has nothing to do with the API key from step 3.',
        },
        { type: 'subheading', text: 'Repository selection' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Signing in with GitHub (or Bitbucket) happens once, if not done already. Qably reads that OAuth token to list the reachable repositories, across the account and its organizations.',
            "In the project's Integrations settings, a repository is selected from the combined list of already-connected and available repositories, sorted by most recent push.",
            'Picking an unconnected repository creates a connection scoped to the organization and generates a webhook secret for it. Picking an already-connected one reuses its existing connection.',
          ],
        },
        { type: 'subheading', text: 'Webhook registration on the provider' },
        {
          type: 'paragraph',
          text: "Qably never registers the webhook automatically; it is added once, in the repository's own settings.",
        },
        {
          type: 'list',
          ordered: true,
          items: [
            "The secret is retrieved by calling POST /connections/:id/webhook-secret from the connection's settings. The response contains the raw secret exactly once, on creation and again each time it is rotated, so it should be copied immediately.",
            'On GitHub, the webhook is added from Settings > Webhooks > Add webhook, on the repository.',
            `Payload URL: ${API_BASE_URL_TOKEN}/webhooks/scm/github`,
            'Content type: application/json',
            'Secret: the value from the previous step',
            'Events: at minimum push.',
            'Pull request events are also worth adding, so Qably can see that activity.',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Qably verifies every delivery against that secret with an HMAC-SHA256 signature (header x-hub-signature-256, formatted as sha256=<hex>) before accepting it. A missing or mismatched signature is rejected outright, not silently ignored.',
        },
        {
          type: 'paragraph',
          text: "Bitbucket connections work the same way, with Bitbucket's own signature header instead of GitHub's. GitHub and Bitbucket are the only two providers supported today.",
        },
        {
          type: 'callout',
          tone: 'info',
          text: "A successful delivery appears in the webhook's history, on the provider's side. On the project's Repository page, the latest ingestion batch, its code changes, and their evidence appear after the next push or pull request.",
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
          text: 'This step wires the first pipeline, an identity the CI can use to report test results, with no session and no user behind it.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'From the project\'s API Keys settings, a key is created with a descriptive name such as "CI/CD Pipeline"; the owner or admin role is required in the organization.',
            'The token has the shape qbly_<lookupId>_<secret> and is shown once, in the creation response, so it should be copied immediately. Qably stores only its SHA-256 hash and cannot show it again.',
            'It is stored as a secret in the CI provider, for example a GitHub Actions repository secret named QABLY_API_KEY, and should never be committed to the repository.',
          ],
        },
        {
          type: 'paragraph',
          text: 'A key is scoped to exactly one project and can only write execution results for that project. It cannot read other projects, list suites, or touch the organization; the project is always derived from the key, never from anything the request sends.',
        },
        {
          type: 'paragraph',
          text: 'Revoking a key, from the same screen, marks it revoked without deleting it, so past runs stay attributed to it. A project can hold several active keys at once, which allows rotating one without ever locking CI out.',
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
          text: "The reporter is a small reference script that is added to the integration's repository, for example as scripts/qably-report.mjs. It reads a JUnit XML file, converts each <testsuite> into one POST /runs/ingest call, and needs only one environment variable: QABLY_API_KEY.",
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'Without QABLY_API_KEY set, the script logs a message and exits 0; it never fails the build over a missing or not-yet-configured integration.',
        },
        {
          type: 'paragraph',
          text: 'jest-junit is added as a dev dependency and configured to write to a report file using two environment variables, before invoking the reporter. Vitest writes JUnit XML natively, with no extra dependency.',
        },
        {
          type: 'codeGroup',
          label: 'Report results from CI',
          variants: [
            {
              language: 'yaml',
              label: 'Jest',
              code: `- name: Unit tests
  env:
    JEST_JUNIT_OUTPUT_DIR: ./reports
    JEST_JUNIT_OUTPUT_NAME: junit.xml
  run: npx jest --ci --reporters=default --reporters=jest-junit

- name: Report results to Qably
  if: always()
  env:
    QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
  run: node scripts/qably-report.mjs ./reports/junit.xml`,
            },
            {
              language: 'yaml',
              label: 'Vitest',
              code: `- name: Unit tests
  run: npx vitest run --reporter=default --reporter=junit --outputFile=./reports/junit.xml

- name: Report results to Qably
  if: always()
  env:
    QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
  run: node scripts/qably-report.mjs ./reports/junit.xml`,
            },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          text: "Both steps use if: always(). Reporting to Qably never gates the build. A Qably outage or a revoked key is Qably's problem, not the pull request's. The test step itself, not the reporting step, is what should fail the CI.",
        },
        {
          type: 'paragraph',
          text: 'A JUnit file with several <testsuite> elements — one per test file, which is how both jest-junit and Vitest write them — becomes one POST /runs/ingest call per suite, sent in sequence. The first report for a suite name creates that suite in Qably automatically; it never has to be pre-created.',
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
          text: 'Each pipeline is confirmed independently, since one can succeed while the other still needs attention.',
        },
        {
          type: 'list',
          items: [
            'Test results are confirmed by opening the project and locating the run the CI just reported. That status is derived from the cases sent: any failing case fails the run, otherwise any pending or running case keeps it running, and it only passes once at least one case has settled to pass or skip (a run where every case is blocked still counts as fail, since nothing in it was actually verified).',
            "Code changes are only relevant once step 2 is complete. The project's Repository page should show that the latest ingestion batch reflects the most recent push or pull request.",
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'If something is missing, the FAQ below covers the two most common causes: a webhook that was never registered, and a CI reporter running without QABLY_API_KEY set.',
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
          text: "The reporter does not care which language produced the report. It reads any file with a <testsuite>/<testcase> structure and derives each case's status from a <failure>, <error>, or <skipped> child element, the same way for every ecosystem below. JUnit XML is generated with each framework's own tooling, and the reporter is then pointed at the resulting file.",
        },
        { type: 'subheading', text: 'JavaScript and TypeScript' },
        {
          type: 'paragraph',
          text: 'Jest and Vitest are covered in the previous step — nothing changes here.',
        },
        {
          type: 'codeGroup',
          label: 'Reporting JUnit XML from any language',
          variants: [
            {
              language: 'shell',
              label: 'Playwright',
              code: `# Environment variable
PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml npx playwright test --reporter=junit

# Report it
node scripts/qably-report.mjs results.xml`,
            },
            {
              language: 'shell',
              label: 'pytest',
              code: `pytest --junitxml=report.xml
node scripts/qably-report.mjs report.xml`,
            },
            {
              language: 'shell',
              label: 'Java — Maven (Surefire)',
              code: `mvn test
# writes target/surefire-reports/TEST-*.xml, one file per test class

for f in target/surefire-reports/TEST-*.xml; do
  node scripts/qably-report.mjs "$f"
done`,
            },
            {
              language: 'shell',
              label: 'Java — Gradle',
              code: `./gradlew test
# writes build/test-results/test/TEST-*.xml, one file per test class

for f in build/test-results/test/TEST-*.xml; do
  node scripts/qably-report.mjs "$f"
done`,
            },
            {
              language: 'shell',
              label: 'PHPUnit 9 and earlier',
              code: `# PHPUnit 9 and earlier
phpunit --log-junit junit.xml
node scripts/qably-report.mjs junit.xml`,
            },
            {
              language: 'shell',
              label: 'PHPUnit 10+',
              code: `<!-- PHPUnit 10+, in phpunit.xml -->
<logging>
    <junit outputFile="junit.xml"/>
</logging>

# PHPUnit 10+
phpunit -c phpunit.xml
node scripts/qably-report.mjs junit.xml`,
            },
            {
              language: 'shell',
              label: '.NET',
              code: `dotnet test --logger:"junit;LogFilePath=test-result.xml"
node scripts/qably-report.mjs test-result.xml`,
            },
            {
              language: 'shell',
              label: 'Go',
              code: `go test -v ./... 2>&1 | go-junit-report > report.xml
node scripts/qably-report.mjs report.xml`,
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
          text: "The exact invocation below was not verified against current documentation — no indexed documentation for go-junit-report was available while writing this guide. It is worth checking the tool's own repository before relying on it.",
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'Case identity is scoped to a suite by the exact name attribute of <testcase>; classname is ignored. Two tests named test_login in different classes therefore resolve to the same test case.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'pytest emits a single <testsuite name="pytest"> for an entire run, while Jest and Vitest emit one per test file. Everything in a pytest run lands in one Qably suite by default. For a granularity closer to Jest and Vitest, junit_suite_name can be set in the pytest configuration, or the run can be split; this is a deliberate difference in defaults, not a bug.',
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
          text: "Reports one suite's execution results. Authenticated with Authorization: Bearer <project API key>. The project and organization come from the key; nothing in the body can override them.",
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
            ['externalId', 'yes', 'Non-empty string. The idempotency key — replaying the same value upserts instead of duplicating.'],
            ['source', 'no', '"api" (default) or "github_actions".'],
            ['suiteId / suiteName', 'exactly one', 'suiteId that does not resolve returns 404. suiteName that does not resolve is adopted: the suite is created on the spot.'],
            ['name', 'yes', "The run's display name, up to 200 characters."],
            ['startedAt / finishedAt', 'no', 'ISO 8601 datetimes with an explicit offset.'],
            ['commitSha / commitMessage / commitAuthor', 'no', 'Free-form commit metadata, up to 64 / 2000 / 200 characters.'],
            ['cases', 'yes', 'At least one entry.'],
          ],
        },
        {
          type: 'table',
          headers: ['Case field', 'Required', 'Notes'],
          rows: [
            ['name', 'yes', 'Up to 120 characters.'],
            ['suiteName', 'no', "Defaults to the resolved suite's name; lets a case keep a different label (for example a Playwright project name) as audit evidence."],
            ['steps', 'no', 'Array of strings, up to 50 entries of 500 characters each. Defaults to an empty array. JUnit XML carries no equivalent field, so reports converted from JUnit always arrive with an empty array — a custom reporter that posts JSON directly can fill it.'],
            ['expectedResult', 'no', "Up to 1000 characters. Defaults to an empty string, for the same reason as steps."],
            ['status', 'yes', 'One of pending, running, pass, fail, skip, blocked.'],
            ['recordedAt', 'no', 'ISO 8601 datetime with an explicit offset.'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Run.status is derived server-side, never trusted from the client: any failing case fails the run; otherwise any pending or running case keeps it running; otherwise it passes once at least one case is pass or skip — a run where every case is blocked still counts as fail, since nothing in it was actually verified.',
        },
        {
          type: 'paragraph',
          text: 'Replaying the same (project, source, externalId) upserts rather than duplicating: the case set is fully replaced, and optional metadata is only overwritten when the replay actually supplies it. Responds 200 OK on both the first report and every replay.',
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
          text: 'Instead of running a custom reporter script, the raw JUnit XML report can be sent directly for Qably to parse server-side. Same authentication as POST /runs/ingest.',
        },
        {
          type: 'paragraph',
          text: 'The report goes in the request body as raw XML, with Content-Type set to application/xml or text/xml (10 MB limit). Everything else travels as query parameters, since there is no JSON body to carry them.',
        },
        {
          type: 'table',
          headers: ['Query parameter', 'Required', 'Notes'],
          rows: [
            ['externalId', 'yes', 'Same idempotency key as POST /runs/ingest.'],
            ['source', 'no', '"api" (default) or "github_actions".'],
            ['suiteId / suiteName', 'no', 'Same resolution rules as POST /runs/ingest. When neither is given, the suite name comes from the report\'s own <testsuite name="..."> attribute.'],
            ['name', 'no', "Defaults to the report's suite name when omitted."],
            ['startedAt / finishedAt / commitSha / commitMessage / commitAuthor', 'no', 'Same fields as POST /runs/ingest.'],
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
          text: 'A case\'s name always comes from <testcase name="...">; classname is read only as a fallback when name is missing entirely, which real JUnit output almost never does. A malformed or empty report answers 400, not 500.',
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
          text: ':provider is github or bitbucket, case-insensitive. There is no API key on this route — every delivery is verified against the HMAC secret of a connection matching the event\'s repository.',
        },
        {
          type: 'table',
          headers: ['', 'GitHub', 'Bitbucket'],
          rows: [
            ['Signature header', 'x-hub-signature-256, formatted sha256=<hex>', 'x-hub-signature, formatted sha256=<hex>'],
            ['Event header', 'x-github-event: push or pull_request', 'x-event-key: repo:push, pullrequest:created, or pullrequest:updated'],
            ['Delivery id header', 'x-github-delivery', 'x-request-uuid'],
            ['Pull request actions handled', 'opened, synchronize', 'created, updated'],
          ],
        },
        {
          type: 'table',
          headers: ['Response', 'Meaning'],
          rows: [
            ['202, { "status": "accepted" }', 'Signature verified, event stored, and queued for processing'],
            ['202, { "status": "duplicate" }', 'The same (provider, delivery id) was already processed — replays are idempotent'],
            ['202, { "status": "ignored" }', 'A recognized provider and a valid signature, but an event type Qably does not act on'],
            ['404', 'Unknown provider in the path'],
            ['401', 'Signature verification failed against every connection for that repository'],
            ['400', 'Body is not valid JSON'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Rate limited to 60 requests per 60 seconds per instance. Accepted events are queued and processed asynchronously — the response confirms receipt, not that processing has finished.',
        },
        {
          type: 'subheading',
          text: 'Rotating the secret',
        },
        {
          type: 'paragraph',
          text: 'Every connection holds its own HMAC secret. When the secret registered with the provider stops matching the one Qably holds, every delivery answers 401 until both values match again. Rotation generates a new secret, stores it encrypted, and returns it once.',
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
          text: 'The 201 response carries { "webhookSecret": "<64 hexadecimal characters>" }. That value cannot be read again, so it must be copied into the repository webhook configuration before the response is discarded. The previous secret stops being valid the moment rotation happens. A project with no repository connected answers 404.',
        },
        {
          type: 'callout',
          tone: 'warning',
          text: 'Rotation is also available in the interface, inside the Repository tab of each project. Between the rotation and saving the new value with the provider, deliveries fail with 401 and must be redelivered from the provider delivery history.',
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
          text: 'A key has the shape qbly_<lookupId>_<secret>: a fixed prefix, a public 6-byte lookup id used to find the row, and a 32-byte secret that is the only part that proves possession. Qably stores just its SHA-256 hash and compares it in constant time — the plaintext token is never recoverable after creation.',
        },
        {
          type: 'table',
          headers: ['Action', 'Endpoint', 'Role required'],
          rows: [
            ['List keys', 'GET /projects/:projectId/api-keys', 'Any organization member'],
            ['Create a key', 'POST /projects/:projectId/api-keys, body { "name": string }', 'owner or admin'],
            ['Revoke a key', 'POST /projects/:projectId/api-keys/:id/revoke', 'owner or admin'],
          ],
        },
        {
          type: 'paragraph',
          text: 'A revoked key is never deleted, so every past run stays attributed to it. It is used in requests as Authorization: Bearer qbly_<lookupId>_<secret>.',
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
          text: "These are the variables set on the integration's own CI, not Qably's deployment configuration; this guide is written for integrators sending data to a hosted Qably, not for people running the platform itself.",
        },
        {
          type: 'table',
          headers: ['Variable', 'Required', 'Notes'],
          rows: [
            ['QABLY_API_KEY', 'yes, to report anything', 'Read by the reporter. If unset, the script logs a message and exits 0 without sending anything; it never fails the build.'],
            ['QABLY_API_BASE_URL', 'no', `Defaults to ${API_BASE_URL_TOKEN}, and is set for a self-hosted deployment or a local run against http://localhost:3001.`],
          ],
        },
      ],
    },
    {
      id: 'platform-overview',
      navLabel: 'Platform overview',
      title: 'Platform overview',
      blocks: [
        {
          type: 'paragraph',
          text: 'The backend exposes the API described in this guide and is organized by business domain, with persistent storage and background processing queues for asynchronous work. The web dashboard is the interface where the team reviews that state.',
        },
        { type: 'subheading', text: 'Backend areas' },
        {
          type: 'table',
          headers: ['Module', 'Responsibility'],
          rows: [
            ['auth', 'Sessions and GitHub OAuth sign-in'],
            ['organizations', 'Organization membership and per-request scoping'],
            ['projects', 'Projects, plan limits, and their connection to a repository'],
            ['connections', 'Repository connections, webhook secrets, and stack detection from repository manifests'],
            ['ingestion', 'Verifies and normalizes incoming SCM webhook events, then queues them for processing'],
            ['runs', 'The two /runs/ingest endpoints, run and case history, and status derivation'],
            ['suites', 'Test suites and their test cases'],
            ['api-keys', 'Issuing, listing, and revoking project-scoped API keys'],
            ['repository', 'Serves the code changes, ingestion batches, and evidence a project has accumulated'],
            ['dashboard', 'The aggregate figures the web dashboard reads'],
            ['notifications', 'Publishes run-completed and run-failed events for a project'],
            ['mailer', 'Transactional email, for example password resets'],
          ],
        },
        {
          type: 'paragraph',
          text: 'Processing is asynchronous: an accepted event is stored and queued immediately, and the response confirms receipt, not that the event has been fully processed. Every domain operation that can fail for an expected reason (not found, name already taken, plan limit reached) returns a typed result instead of throwing, so the boundary between an expected business rule and an actual server error stays explicit.',
        },
        { type: 'subheading', text: 'Web dashboard surfaces' },
        {
          type: 'list',
          items: [
            'Dashboard — pass-rate KPIs over the last 7 days, a project health table, a traceability calendar, and recent activity',
            "Projects — creation, the technology selector, and each project's own settings",
            "A project's API Keys screen — create, list, and revoke keys",
            "A project's Repository page — the code changes, ingestion batches, and evidence fed by the SCM webhook",
          ],
        },
      ],
    },
    {
      id: 'faq',
      navLabel: 'FAQ and troubleshooting',
      title: 'FAQ and troubleshooting',
      blocks: [
        {
          type: 'faq',
          items: [
            {
              question: 'CI gets a 403 with a Cloudflare "Just a moment..." page',
              answer: [
                {
                  type: 'paragraph',
                  text: "The API sits behind a bot challenge, and requests from datacenter IPs (which is what most CI runners are) get challenged instead of passed through. This needs a WAF rule that skips the challenge for the API hostname, covering both /runs/ingest and /webhooks/scm/* — a rule scoped to only one of those paths leaves the other pipeline broken.",
                },
              ],
            },
            {
              question: 'CI is green but nothing shows up in Qably',
              answer: [
                {
                  type: 'paragraph',
                  text: 'This is intentional: a reporting failure is logged as a warning and never fails the build. It helps to check the workflow logs for a ::warning:: line from qably-report, and confirm that QABLY_API_KEY is actually set as a secret on the job that ran the reporting step.',
                },
              ],
            },
            {
              question: '404 — suite not found',
              answer: [
                {
                  type: 'paragraph',
                  text: 'An unresolvable suiteId is treated as a client error on purpose: an explicit id is a claim that something already exists, and the endpoint never creates a suite from one. suiteName can be sent instead — an unresolved name is adopted automatically, creating the suite on the spot.',
                },
              ],
            },
            {
              question: 'Cases arrive with no steps and no expected result',
              answer: [
                {
                  type: 'paragraph',
                  text: 'Expected when the report came from JUnit XML: the format carries neither field, so both the reporter and POST /runs/ingest/junit send an empty array and an empty string for them. The API accepts both fields if a custom reporter posts JSON directly to POST /runs/ingest with steps and expectedResult filled in.',
                },
              ],
            },
            {
              question: "A project's Repository page is empty",
              answer: [
                {
                  type: 'paragraph',
                  text: 'The SCM webhook was never configured for that project; step 2 covers how to do it. Reporting test results from CI never feeds the Repository page; only the webhook does.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

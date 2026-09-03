import type { CodeLanguage } from '../lib/highlight';

export type SnippetId = 'rest' | 'githubAction' | 'playwright';

export const SNIPPET_LANGUAGES: Record<SnippetId, CodeLanguage> = {
  rest: 'shell',
  githubAction: 'yaml',
  playwright: 'typescript',
};

export const SNIPPETS: Record<SnippetId, string> = {
  rest: `curl -X POST \\
  https://api.qably.dev/runs/ingest \\
  -H "Authorization: Bearer $QABLY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "run-8412",
    "source": "api",
    "suiteName": "Checkout",
    "name": "Nightly regression",
    "commitSha": "a41f9c2",
    "cases": [
      {
        "name": "rejects an expired card",
        "status": "pass"
      },
      {
        "name": "retries the webhook on 429",
        "status": "fail"
      }
    ]
  }'`,

  githubAction: `name: Qably
on: [push, pull_request]

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --reporter=json

      - name: Report to Qably
        if: always()
        env:
          QABLY_KEY: \${{ secrets.QABLY_API_KEY }}
        run: |
          node scripts/qably-report.mjs \\
            --external-id "\${{ github.run_id }}" \\
            --commit "\${{ github.sha }}"`,

  playwright: `import { readFile } from 'node:fs/promises';

// Playwright's own JSON reporter, mapped
// onto the POST /runs/ingest contract.
const url = 'https://api.qably.dev/runs/ingest';
const key = process.env.QABLY_API_KEY;

const raw = await readFile('results.json', 'utf8');
const report = JSON.parse(raw);

const cases = report.suites.flatMap((suite) =>
  suite.specs.map((spec) => ({
    name: spec.title,
    suiteName: suite.title,
    status: spec.ok ? 'pass' : 'fail',
  })),
);

await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${key}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    externalId: process.env.GITHUB_RUN_ID,
    suiteName: 'Playwright',
    name: 'e2e',
    cases,
  }),
});`,
};

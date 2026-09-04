import type { CodeLanguage } from '../lib/highlight';
import { API_BASE_URL_TOKEN } from '../content/types';

export type SnippetId = 'junit' | 'githubAction' | 'rest';

export const SNIPPET_LANGUAGES: Record<SnippetId, CodeLanguage> = {
  junit: 'shell',
  githubAction: 'yaml',
  rest: 'shell',
};

export const SNIPPETS: Record<SnippetId, string> = {
  junit: `# Any runner that writes JUnit XML works:
#   vitest --reporter=junit
#   jest --reporters=jest-junit
#   playwright test --reporter=junit
#   pytest --junitxml=junit.xml

URL=${API_BASE_URL_TOKEN}/runs/ingest/junit

curl -X POST "$URL?externalId=$RUN_ID" \\
  -H "Authorization: Bearer $QABLY_API_KEY" \\
  -H "Content-Type: application/xml" \\
  --data-binary @junit.xml`,

  githubAction: `name: Tests
on: [push, pull_request]

env:
  QABLY: ${API_BASE_URL_TOKEN}/runs/ingest/junit

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest --reporter=junit

      - name: Report to Qably
        if: always()
        env:
          KEY: \${{ secrets.QABLY_API_KEY }}
          ID: \${{ github.run_id }}
        run: |
          curl -X POST "$QABLY?externalId=$ID" \\
            -H "Authorization: Bearer $KEY" \\
            -H "Content-Type: application/xml" \\
            --data-binary @junit.xml`,

  rest: `# For a harness that emits no JUnit report.

curl -X POST \\
  ${API_BASE_URL_TOKEN}/runs/ingest \\
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
};

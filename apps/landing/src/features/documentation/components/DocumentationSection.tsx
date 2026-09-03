import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode, ArrowRight } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import type { DocumentationTranslations } from '../../i18n/types';

interface DocumentationSectionProps {
  t: DocumentationTranslations;
  locale?: string;
}

type TabId = 'rest' | 'githubAction' | 'playwright';

const SNIPPETS: Record<TabId, string> = {
  rest: `curl -X POST https://api.qably.dev/runs/ingest \
  -H "Authorization: Bearer $QABLY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "run-8412",
    "source": "api",
    "suiteName": "Checkout",
    "name": "Nightly regression",
    "commitSha": "a41f9c2",
    "cases": [
      { "name": "rejects an expired card", "status": "pass" },
      { "name": "retries the webhook on 429", "status": "fail" }
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
      - run: pnpm test --reporter=json --outputFile=results.json

      - name: Report to Qably
        if: always()
        env:
          QABLY_API_KEY: \${{ secrets.QABLY_API_KEY }}
        run: |
          node scripts/qably-report.mjs results.json \
            --external-id "\${{ github.run_id }}" \
            --source github_actions \
            --commit "\${{ github.sha }}"`,

  playwright: `import { readFile } from 'node:fs/promises';

// Maps Playwright's built-in JSON reporter onto POST /runs/ingest.
const report = JSON.parse(await readFile('results.json', 'utf8'));

const cases = report.suites.flatMap((suite) =>
  suite.specs.map((spec) => ({
    name: spec.title,
    suiteName: suite.title,
    status: spec.ok ? 'pass' : 'fail',
  })),
);

await fetch('https://api.qably.dev/runs/ingest', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.QABLY_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    externalId: process.env.GITHUB_RUN_ID ?? crypto.randomUUID(),
    suiteName: 'Playwright',
    name: 'e2e',
    cases,
  }),
});`,
};

const TABS: { id: TabId; icon: Icon; labelKey: keyof DocumentationTranslations }[] = [
  { id: 'rest', icon: Terminal, labelKey: 'tabRest' },
  { id: 'githubAction', icon: FileCode, labelKey: 'tabGithubAction' },
  { id: 'playwright', icon: FileCode, labelKey: 'tabPlaywright' },
];

export function DocumentationSection({ t, locale = 'es' }: DocumentationSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('rest');
  const [copied, setCopied] = useState(false);
  const isEn = locale === 'en';

  const currentSnippet = SNIPPETS[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="documentation" className="py-24 px-6 max-w-5xl mx-auto font-sans" aria-labelledby="docs-heading">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <h2 id="docs-heading" className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
          {t.title}
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
          {t.subtitle}
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-zinc-900/60 px-3 py-2 sm:px-4 sm:py-2.5">
          <div
            role="tablist"
            aria-label={t.title}
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all cursor-pointer sm:px-3 sm:text-xs ${
                    isActive ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <tab.icon size={14} aria-hidden="true" />
                  {t[tab.labelKey]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98] cursor-pointer sm:px-3 sm:text-xs"
            aria-label={t.copyCode}
          >
            {copied ? (
              <>
                <Check size={14} weight="bold" className="text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-400">{t.copied}</span>
              </>
            ) : (
              <>
                <Copy size={14} aria-hidden="true" />
                <span className="hidden sm:inline">{t.copyCode}</span>
              </>
            )}
          </button>
        </div>

        <div className="min-h-[200px] overflow-x-auto bg-black p-4 font-mono text-[11px] leading-relaxed text-zinc-300 sm:p-5 sm:text-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <pre>
                <code>{currentSnippet}</code>
              </pre>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.08] bg-zinc-950 px-4 py-3 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:text-xs">
          <span className="text-zinc-400">
            {isEn
              ? 'Looking for the full API reference and the run ingestion schema?'
              : '¿Buscas la referencia completa de la API y el esquema de ingesta de ejecuciones?'}
          </span>
          <a
            href={isEn ? '/en/docs' : '/docs'}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-white transition-colors hover:text-zinc-300"
          >
            <span>{isEn ? 'Read the documentation' : 'Ver la documentación'}</span>
            <ArrowRight size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

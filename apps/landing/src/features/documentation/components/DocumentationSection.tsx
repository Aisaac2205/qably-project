import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode, ArrowRight } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import type { DocumentationTranslations } from '../../i18n/types';

interface DocumentationSectionProps {
  t: DocumentationTranslations;
  locale?: string;
}

const SNIPPETS = {
  cli: `# Inicia Qably en tu proyecto existente
pnpm dlx @qably/cli init

# O instala como dependencia de desarrollo
pnpm add -D @qably/cli

# Ejecuta análisis y sincroniza con tu dashboard
pnpm qably scan --token=qbly_live_8f2a1c4d9e6b`,

  githubAction: `name: Qably Quality Gate
on: [push, pull_request]

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - name: Install dependencies
        run: pnpm install
      - name: Run Tests with Qably Telemetry
        run: pnpm test --reporter=@qably/reporter
        env:
          QABLY_TOKEN: \${{ secrets.QABLY_TOKEN }}
          QABLY_PROJECT_ID: \${{ vars.QABLY_PROJECT_ID }}`,

  playwright: `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  reporter: [
    ['html'],
    ['@qably/playwright-reporter', {
      apiKey: process.env.QABLY_TOKEN,
      projectId: 'proj_ecommerce_live',
      captureScreenshotsOnFailure: true,
    }],
  ],
});`,

  jest: `/** @type {import('jest').Config} */
module.exports = {
  reporters: [
    'default',
    ['@qably/jest-reporter', {
      apiKey: process.env.QABLY_TOKEN,
      projectId: process.env.QABLY_PROJECT_ID,
      autoReportFlaky: true,
    }],
  ],
};`,
};

export function DocumentationSection({ t, locale = 'es' }: DocumentationSectionProps) {
  const [activeTab, setActiveTab] = useState<'cli' | 'githubAction' | 'playwright' | 'jest'>('cli');
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
        <p className="text-base text-zinc-400 leading-relaxed">
          {t.subtitle}
        </p>
      </div>

      {/* Code Window Box */}
      <div className="rounded-xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Tab Header */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-zinc-900/60 gap-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('cli')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'cli'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Terminal size={14} />
              {t.tabCli}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('githubAction')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'githubAction'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileCode size={14} />
              {t.tabGithubAction}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('playwright')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'playwright'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileCode size={14} />
              {t.tabPlaywright}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('jest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'jest'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileCode size={14} />
              {t.tabJest}
            </button>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] transition-all border border-white/10 shrink-0 cursor-pointer"
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check size={14} weight="bold" className="text-emerald-400" />
                <span className="text-emerald-400">{t.copied}</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>{t.copyCode}</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content with Motion */}
        <div className="p-5 font-mono text-xs sm:text-sm text-zinc-300 overflow-x-auto leading-relaxed bg-black min-h-[160px]">
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

        {/* Footer Link to Dedicated Documentation Page */}
        <div className="px-5 py-3 border-t border-white/[0.08] bg-zinc-950 flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            {isEn ? 'Looking for full API schemas, NestJS backend setup, and Prisma models?' : '¿Buscas esquemas completos de API, setup de NestJS y modelos de Prisma?'}
          </span>
          <a
            href={isEn ? '/en/docs' : '/docs'}
            className="inline-flex items-center gap-1 text-white hover:text-zinc-300 font-medium transition-colors"
          >
            <span>{isEn ? 'Read full documentation' : 'Ver documentación completa'}</span>
            <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}

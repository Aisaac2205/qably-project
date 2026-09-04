import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode, ArrowRight } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import type { DocumentationTranslations } from '../../i18n/types';
import { highlight, type TokenKind } from '../lib/highlight';
import { API_BASE_URL_TOKEN } from '../content/types';
import { SNIPPETS, SNIPPET_LANGUAGES, type SnippetId } from './snippets';
import { getApiBaseUrl } from '@/lib/api-config';

interface DocumentationSectionProps {
  t: DocumentationTranslations;
  locale?: string;
}

type TabId = SnippetId;

const TOKEN_CLASSES: Record<TokenKind, string> = {
  plain: 'text-code-plain',
  comment: 'text-code-comment italic',
  keyword: 'text-code-keyword',
  string: 'text-code-string',
  number: 'text-code-number',
  property: 'text-code-property',
  punctuation: 'text-code-punctuation',
};

const API_BASE_URL = getApiBaseUrl();

const TABS: { id: TabId; icon: Icon; labelKey: keyof DocumentationTranslations }[] = [
  { id: 'junit', icon: FileCode, labelKey: 'tabJunit' },
  { id: 'githubAction', icon: FileCode, labelKey: 'tabGithubAction' },
  { id: 'rest', icon: Terminal, labelKey: 'tabRest' },
];

export function DocumentationSection({ t, locale = 'es' }: DocumentationSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('junit');
  const [copied, setCopied] = useState(false);
  const isEn = locale === 'en';

  const currentSnippet = SNIPPETS[activeTab].split(API_BASE_URL_TOKEN).join(API_BASE_URL);

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
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
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

        <div className="min-h-[220px] bg-black p-4 font-mono text-[11px] leading-relaxed text-code-plain sm:p-5 sm:text-xs">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <pre className="whitespace-pre-wrap break-words">
                <code>
                  {highlight(currentSnippet, SNIPPET_LANGUAGES[activeTab]).map((token, index) => (
                    <span key={index} className={TOKEN_CLASSES[token.kind]}>
                      {token.value}
                    </span>
                  ))}
                </code>
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

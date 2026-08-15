'use client'

import type { Evidence } from '@qably/types'
import { FileText } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ProvenanceSummary({ evidence }: { evidence: Evidence }) {
  const { t } = useTranslation()

  return (
    <section aria-labelledby={`provenance-${evidence.id}`} className="space-y-3">
      <h4 id={`provenance-${evidence.id}`} className="flex items-center gap-2 text-sm font-medium text-default">
        <FileText size={16} aria-hidden="true" />
        {t('reviewFlow.provenance')}
      </h4>
      <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">{t('reviewFlow.source')}</dt>
        <dd className="min-w-0 break-all text-default">{evidence.uri}</dd>
        {evidence.excerpt && <>
          <dt className="text-muted">{t('reviewFlow.excerpt')}</dt>
          <dd className="min-w-0 break-words rounded border border-border bg-surface p-3 leading-relaxed text-default">{evidence.excerpt}</dd>
        </>}
      </dl>
    </section>
  )
}

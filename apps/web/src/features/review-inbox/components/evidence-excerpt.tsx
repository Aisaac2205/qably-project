'use client'

import { ChatCircleText, Code } from '@phosphor-icons/react'
import type { Evidence } from '@qably/types'
import { CodeSnippet } from './code-snippet'
import { useTranslation } from '@/lib/i18n'
import { isChatRequestEvidence } from '@/features/review-inbox/lib/evidence-source'

interface EvidenceExcerptProps {
  evidence: Pick<Evidence, 'kind' | 'uri' | 'excerpt'>
}

export function EvidenceExcerpt({ evidence }: EvidenceExcerptProps) {
  const { t } = useTranslation()

  if (evidence.excerpt === undefined || evidence.excerpt === '') return null

  if (isChatRequestEvidence(evidence)) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <ChatCircleText size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
          <h4 className="text-xs sm:text-sm font-semibold text-default">
            {t('reviewInbox.chatRequestHeading')}
          </h4>
        </div>
        <blockquote className="ml-6 border-l-2 border-border pl-3 text-sm text-muted whitespace-pre-wrap">
          {evidence.excerpt}
        </blockquote>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Code size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
        <h4 className="text-xs sm:text-sm font-semibold text-default">
          {t('reviewInbox.sourceSnippet')}
        </h4>
      </div>
      <div className="ml-6">
        <CodeSnippet code={evidence.excerpt} language="TypeScript" />
      </div>
    </div>
  )
}

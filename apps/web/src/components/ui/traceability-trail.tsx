'use client'

import { useId } from 'react'
import type { TraceabilityLink } from '@qably/types'
import { GitBranch } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function TraceabilityTrail({ links }: { links: TraceabilityLink[] }) {
  const { t } = useTranslation()
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <h4 id={titleId} className="flex items-center gap-2 text-sm font-medium text-default">
        <GitBranch size={16} aria-hidden="true" />
        {t('reviewFlow.traceability')}
      </h4>
      <ol className="space-y-2 border-l border-border pl-4">
        {links.map((link) => (
          <li key={link.id} className="min-w-0 text-sm text-default">
            <span>{t(`reviewFlow.relation.${link.relation}`)}</span>
            <span className="text-muted"> {t(`reviewFlow.entity.${link.to.type}`)}: </span>
            <span className="break-all font-mono text-xs">{link.to.id}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

'use client'

import { useId } from 'react'
import type { Evidence } from '@qably/types'
import { Paperclip } from '@phosphor-icons/react'
import { EntityList } from '@/components/ui/entity-list'
import { useTranslation } from '@/lib/i18n'

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const { t } = useTranslation()
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <h4 id={titleId} className="flex items-center gap-2 text-sm font-medium text-default">
        <Paperclip size={16} aria-hidden="true" />
        {t('reviewFlow.evidence')}
      </h4>
      <EntityList aria-label={t('reviewFlow.evidence')} className="rounded border border-border">
        {evidence.map((item) => (
          <li key={item.id} className="min-w-0 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-default">{item.title}</p>
            <p className="text-xs text-muted">{t(`reviewFlow.evidenceKind.${item.kind}`)}</p>
          </li>
        ))}
      </EntityList>
    </section>
  )
}

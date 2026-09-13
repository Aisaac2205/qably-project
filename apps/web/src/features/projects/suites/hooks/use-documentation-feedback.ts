'use client'

import { useEffect, useRef } from 'react'
import type { DocumentFilesResult, DocumentFilesSkipReason } from '@qably/types'
import type { DocumentFilesMutation } from '@/features/projects/suites/components/document-with-aeris'
import type { DocumentationWatchStatus } from '@/features/projects/suites/lib/documentation-watch'
import { useTranslation } from '@/lib/i18n'
import { notify } from '@/lib/notify'

const SKIP_KEYS: Record<DocumentFilesSkipReason, string> = {
  'no-source-file': 'suites.documentFilesSkippedNoSourceFile',
  'no-automation-key': 'suites.documentFilesSkippedNoAutomationKey',
  'already-pending': 'suites.documentFilesSkippedAlreadyPending',
  'human-documented': 'suites.documentFilesSkippedHumanDocumented',
}

interface UseDocumentationFeedbackInput {
  documentation: DocumentFilesMutation
  watchStatus: DocumentationWatchStatus
  documentedCount: number
}

export function useDocumentationFeedback({
  documentation,
  watchStatus,
  documentedCount,
}: UseDocumentationFeedbackInput): void {
  const { t } = useTranslation()
  const announcedResult = useRef<DocumentFilesResult | undefined>(undefined)
  const announcedError = useRef<unknown>(undefined)
  const announcedStatus = useRef<DocumentationWatchStatus>('idle')

  useEffect(() => {
    const result = documentation.data
    if (result === undefined || result === announcedResult.current) return
    announcedResult.current = result

    const skips = result.casesSkipped.map((skip) =>
      t(SKIP_KEYS[skip.reason], { count: skip.count }),
    )
    const title =
      result.filesEnqueued === 0
        ? t('suites.documentFilesNothingToDo')
        : t('suites.documentFilesQueued', {
            cases: result.casesTargeted,
            files: result.filesEnqueued,
          })

    notify.info(title, skips.length === 0 ? undefined : { description: skips.join(' ') })
  }, [documentation.data, t])

  useEffect(() => {
    const error = documentation.error
    if (error === null || error === announcedError.current) return
    announcedError.current = error

    notify.error(t('suites.documentFilesError'))
  }, [documentation.error, t])

  useEffect(() => {
    if (watchStatus === announcedStatus.current) return
    announcedStatus.current = watchStatus

    if (watchStatus === 'settled') {
      notify.success(t('suites.documentFilesSettled', { count: documentedCount }))
    }
    if (watchStatus === 'timed-out') {
      notify.warning(t('suites.documentFilesStillWorking'))
    }
  }, [watchStatus, documentedCount, t])
}

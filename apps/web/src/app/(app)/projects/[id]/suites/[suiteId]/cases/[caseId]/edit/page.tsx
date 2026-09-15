'use client'

import { use } from 'react'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'
import { CaseForm } from '@/features/projects/suites/components/case-form'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

type Params = Promise<{ id: string; suiteId: string; caseId: string }>

export default function EditCasePage({ params }: { params: Params }) {
  const { id, suiteId, caseId } = use(params)
  const { t } = useTranslation()
  const { suite, isLoading } = useSuite(suiteId)
  const testCase = suite?.cases.find((c) => c.id === caseId)

  if (isLoading) {
    return (
      <div className="w-full px-5 py-6 sm:px-7 lg:py-8">
        <StateView kind="loading" title={t('suites.loading')} />
      </div>
    )
  }

  if (!suite || !testCase) {
    return (
      <div className="w-full px-5 py-6 sm:px-7 lg:py-8">
        <StateView kind="empty" title={t('suites.caseNotFound')} />
      </div>
    )
  }

  return <CaseForm projectId={id} suiteId={suiteId} testCase={testCase} />
}

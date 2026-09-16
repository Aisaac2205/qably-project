'use client'

import { use } from 'react'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'
import { SuiteForm } from '@/features/projects/suites/components/suite-form'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

type Params = Promise<{ id: string; suiteId: string }>

export default function EditSuitePage({ params }: { params: Params }) {
  const { id, suiteId } = use(params)
  const { t } = useTranslation()
  const { suite, isLoading, isError } = useSuite(suiteId)

  if (isLoading) {
    return (
      <div className="w-full px-5 py-6 sm:px-7 lg:py-8">
        <StateView kind="loading" title={t('suites.loading')} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="w-full px-5 py-6 sm:px-7 lg:py-8">
        <StateView kind="error" title={t('suites.suiteLoadError')} focusOnMount />
      </div>
    )
  }

  if (!suite) {
    return (
      <div className="w-full px-5 py-6 sm:px-7 lg:py-8">
        <StateView kind="empty" title={t('suites.suiteNotFound')} />
      </div>
    )
  }

  return <SuiteForm projectId={id} suite={suite} />
}

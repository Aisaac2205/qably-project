'use client'

import { use } from 'react'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { SuiteList } from '@/features/projects/suites/components/suite-list'
import { useTranslation } from '@/lib/i18n'
import { useProject } from '@/lib/use-mock-store'

type Params = Promise<{ id: string }>

export default function SuitesPage({ params }: { params: Params }) {
  const { id } = use(params)
  const project = useProject(id)
  const { t } = useTranslation()

  return (
    <div className="max-w-5xl 2xl:max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: `/projects/${id}` }] : []),
          { label: t('sidebar.testLibrary') },
        ]}
      />
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-default text-wrap-balance">
          {t('sidebar.testLibrary')}
        </h1>
      </header>
      <SuiteList projectId={id} />
    </div>
  )
}

'use client'

import { use } from 'react'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { SuiteList } from '@/features/projects/suites/components/suite-list'
import { useTranslation } from '@/lib/i18n'
import { useProject } from '@/features/projects/hooks/use-project'

type Params = Promise<{ id: string }>

export default function SuitesPage({ params }: { params: Params }) {
  const { id } = use(params)
  const { project } = useProject(id)
  const { t } = useTranslation()

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: `/projects/${id}` }] : []),
          { label: t('sidebar.testLibrary') },
        ]}
      />
      <h1 className="sr-only">{t('sidebar.testLibrary')}</h1>
      <SuiteList projectId={id} />
    </div>
  )
}

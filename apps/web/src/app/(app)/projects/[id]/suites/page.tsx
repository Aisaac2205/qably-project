'use client'

import { use } from 'react'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { useProject } from '@/lib/use-mock-store'
import { SuiteKpiRow } from '@/features/suites/components/suite-kpi-row'
import { SuiteList } from '@/features/suites/components/suite-list'

type Params = Promise<{ id: string }>

export default function SuitesPage({ params }: { params: Params }) {
  const { id } = use(params)
  const project = useProject(id)

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${id}` },
          { label: 'Suites' },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-default text-wrap-balance">
          Suites
        </h1>
        {project?.description && (
          <p className="text-sm text-muted mt-1 max-w-[65ch] text-wrap-pretty">
            {project.description}
          </p>
        )}
      </header>
      <SuiteKpiRow projectId={id} />
      <SuiteList projectId={id} />
    </div>
  )
}

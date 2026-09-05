'use client'

import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { PageHeader } from '@/components/ui/page-header'
import { ApiKeysManager } from '@/features/projects/api-keys/components/api-keys-manager'
import { useTranslation } from '@/lib/i18n'
import { useProject } from '@/features/projects/hooks/use-project'
import { projectRootPath } from '@/features/projects/lib/routes'

export function ApiKeysPageClient({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { project } = useProject(projectId)

  return (
    <div className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter">
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('apiKeys.title') },
        ]}
      />

      <PageHeader title={t('apiKeys.title')} description={t('apiKeys.subtitle')} />

      <ApiKeysManager projectId={projectId} />
    </div>
  )
}

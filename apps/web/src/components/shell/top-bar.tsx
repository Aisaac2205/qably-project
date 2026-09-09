'use client'

import { usePathname } from 'next/navigation'
import type { Project } from '@qably/types'
import { useProject } from '@/features/projects/hooks/use-project'
import { useProjectRouteId } from '@/features/projects/hooks/use-project-route-id'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NotificationsMenu } from '@/features/notifications'
import { useTranslation } from '@/lib/i18n'
import { useCurrentUser } from '@/features/auth/hooks/use-current-user'
import { UserAvatar } from './user-avatar'

function getPageTitle(pathname: string, project: Project | undefined, t: (key: string) => string): string {
  if (pathname === '/' || pathname === '/dashboard') return t('sidebar.dashboard')
  if (pathname === '/projects') return t('sidebar.projects')
  if (pathname === '/projects/new') return t('projects.newButton')
  if (pathname === '/review-inbox') return t('sidebar.reviewInbox')
  if (pathname === '/notifications') return t('sidebar.notifications')
  if (pathname === '/settings') return t('sidebar.settings')
  if (pathname === '/integrations') return t('sidebar.integrations')

  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'projects' && segments.length >= 2) {
    const subRoute = segments[2]
    if (!subRoute) return project?.name || t('sidebar.projects')
    if (subRoute === 'repository') return t('sidebar.repository')
    if (subRoute === 'ai-review') return t('sidebar.review')
    if (subRoute === 'suites') return t('sidebar.testLibrary')
    if (subRoute === 'runs') return t('sidebar.runs')
    if (subRoute === 'quality') return t('sidebar.quality')
    if (subRoute === 'reports') return t('sidebar.quality')
    return project?.name || t('sidebar.projects')
  }

  return ''
}

export function TopBar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const projectId = useProjectRouteId()
  const { project } = useProject(projectId ?? '')
  const currentUser = useCurrentUser()
  const title = getPageTitle(pathname, project, t)

  return (
    <div className="flex h-14 items-center justify-between bg-sidebar px-4 md:px-6">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <SidebarTrigger className="md:hidden -ml-1" />
        {title && (
          <h1
            id={pathname === '/dashboard' || pathname === '/' ? 'dashboard-title' : 'page-title'}
            className="text-base md:text-lg font-semibold tracking-[-0.015em] text-default"
          >
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationsMenu />

        <UserAvatar name={currentUser.name} image={currentUser.image} size={28} />
      </div>
    </div>
  )
}

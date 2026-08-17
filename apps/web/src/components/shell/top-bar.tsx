'use client'

import { usePathname } from 'next/navigation'
import type { Project } from '@qably/types'
import { useProject } from '@/lib/use-mock-store'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NotificationsMenu } from '@/features/notifications'
import { useTranslation } from '@/lib/i18n'

function healthColor(score: number): string {
  if (score >= 80) return 'bg-pass'
  if (score >= 50) return 'bg-warn'
  return 'bg-fail'
}

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
    if (subRoute === 'reports') return t('sidebar.quality')
    return project?.name || t('sidebar.projects')
  }

  return ''
}

export function TopBar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const segments = pathname.split('/').filter(Boolean)
  const isProjectRoute = segments[0] === 'projects' && segments.length >= 3
  const projectId = segments[0] === 'projects' && segments.length >= 2 ? segments[1] : null
  const project = useProject(projectId ?? '')
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
        {isProjectRoute && project && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <div
              className={`w-2 h-2 rounded-full ${healthColor(project.healthScore)}`}
              aria-hidden="true"
            />
            <span className="truncate max-w-[180px] font-medium">{project.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationsMenu />

        <span
          aria-label="Current user: Isaac F."
          className="flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg"
        >
          IF
        </span>
      </div>
    </div>
  )
}

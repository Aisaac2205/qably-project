'use client'

import { usePathname } from 'next/navigation'
import { useProject } from '@/lib/use-mock-store'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { NotificationsMenu } from '@/features/notifications'

function healthColor(score: number): string {
  if (score >= 80) return 'bg-pass'
  if (score >= 50) return 'bg-warn'
  return 'bg-fail'
}

export function TopBar() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const isProjectRoute = segments[0] === 'projects' && segments.length >= 3
  const projectId = segments[0] === 'projects' && segments.length >= 2 ? segments[1] : null
  const project = useProject(projectId ?? '')

  return (
    <div className="h-14 flex items-center justify-between px-4 md:px-6 bg-surface border-b border-border">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <SidebarTrigger className="-ml-1" />
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

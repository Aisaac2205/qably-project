'use client'

import { usePathname } from 'next/navigation'
import { MagnifyingGlass } from '@phosphor-icons/react'
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
        {/* Search trigger (visual placeholder — command palette lands in Phase 2) */}
        <button
          type="button"
          aria-label="Search"
          className="hidden sm:flex w-56 h-8 items-center justify-between px-2.5 text-xs text-muted-foreground bg-canvas border border-border rounded-lg hover:bg-surface-hover hover:text-default transition-colors duration-150 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <MagnifyingGlass size={14} aria-hidden="true" />
            <span>Search...</span>
          </span>
          <kbd className="text-[10px] font-mono bg-surface border border-border px-1.5 py-0.5 rounded text-muted">
            ⌘K
          </kbd>
        </button>

        <NotificationsMenu />

        {/* User menu */}
        <button
          type="button"
          aria-label="User menu"
          className="size-7 rounded-full bg-primary flex items-center justify-center text-primary-fg text-xs font-bold select-none shrink-0 cursor-pointer hover:bg-primary-hover transition-colors duration-150"
        >
          IF
        </button>
      </div>
    </div>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import { MagnifyingGlass, Bell } from '@phosphor-icons/react'
import { useProject } from '@/lib/use-mock-store'

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
    <div className="h-16 flex items-center justify-between px-6 bg-surface border-b border-border shadow-sm">
      <div className="flex-1 min-w-0">
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

      <div className="flex items-center gap-4 shrink-0">
        {/* Mock Search Bar */}
        <button
          aria-label="Search"
          className="w-64 h-9 flex items-center justify-between px-3 text-xs text-muted-foreground bg-canvas border border-border rounded-lg shadow-sm hover:border-border-default/60 hover:text-default transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={16} className="text-muted-foreground" />
            <span>Search...</span>
          </div>
          <span className="text-[10px] font-mono bg-surface border border-border px-1.5 py-0.5 rounded text-muted shadow-sm">⌘K</span>
        </button>

        {/* Notifications Icon */}
        <button
          aria-label="Notifications"
          className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-canvas text-default hover:text-primary transition-all duration-150 cursor-pointer"
        >
          <Bell size={20} />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-pink-500 rounded-full border border-surface" />
        </button>

        {/* User profile dropdown button */}
        <button
          aria-label="User menu"
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-fg text-xs font-bold select-none shrink-0 shadow-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all duration-150"
        >
          IF
        </button>
      </div>
    </div>
  )
}

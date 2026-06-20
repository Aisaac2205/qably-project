'use client'

import { usePathname } from 'next/navigation'
import { MagnifyingGlass } from '@phosphor-icons/react'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  suites: 'Suites',
  runs: 'Runs',
  pipelines: 'Pipelines',
  reports: 'Reports',
  'ai-review': 'AI Review',
  settings: 'Settings',
}

function parseBreadcrumb(pathname: string): { context: string | null; section: string } {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'projects' && segments.length >= 3) {
    const section = ROUTE_LABELS[segments[2]] ?? segments[2]
    return { context: segments[1], section }
  }
  const label = ROUTE_LABELS[segments[0]] ?? segments[0] ?? 'Dashboard'
  return { context: null, section: label }
}

export function TopBar() {
  const pathname = usePathname()
  const { context, section } = parseBreadcrumb(pathname)

  return (
    <div className="h-9 flex items-center gap-2 px-3 bg-surface border-b border-border">
      <div className="flex-1 text-sm">
        {context ? (
          <span>
            <span className="text-muted">{context}</span>
            <span className="mx-1.5 text-muted">›</span>
            <span className="text-default font-semibold">{section}</span>
          </span>
        ) : (
          <span className="text-default font-semibold">{section}</span>
        )}
      </div>

      <button
        aria-label="Search"
        className="flex items-center gap-1.5 h-6 px-2.5 text-xs text-muted bg-canvas border border-border rounded"
      >
        <MagnifyingGlass size={12} />
        <span>⌘K</span>
      </button>

      <div
        aria-label="User menu"
        className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-fg text-[10px] font-bold select-none"
      >
        IF
      </div>
    </div>
  )
}

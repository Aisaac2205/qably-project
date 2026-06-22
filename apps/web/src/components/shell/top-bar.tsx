'use client'

import { usePathname } from 'next/navigation'
import { MagnifyingGlass, Bell } from '@phosphor-icons/react'
import { Breadcrumbs } from './breadcrumbs'
import { useProject } from '@/lib/use-mock-store'

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

function healthColor(score: number): string {
  if (score >= 80) return 'bg-pass'
  if (score >= 50) return 'bg-warn'
  return 'bg-fail'
}

function buildBreadcrumbs(pathname: string): Array<{ label: string; href?: string }> {
  const segments = pathname.split('/').filter(Boolean)

  if (segments[0] === 'projects' && segments.length >= 2) {
    const items: Array<{ label: string; href?: string }> = [
      { label: 'Projects', href: '/projects' },
    ]

    const projectId = segments[1]
    items.push({ label: projectId, href: `/projects/${projectId}` })

    if (segments.length >= 3) {
      const sectionLabel = ROUTE_LABELS[segments[2]] ?? segments[2]
      items.push({ label: sectionLabel })
    }

    if (segments.length >= 4 && segments[3] !== 'new') {
      const subLabel = ROUTE_LABELS[segments[2]] ?? segments[2]
      items.length = 2
      items.push({ label: subLabel, href: `/projects/${projectId}/${segments[2]}` })
      items.push({ label: segments[3].slice(0, 20) })
    }

    return items
  }

  const label = ROUTE_LABELS[segments[0]] ?? segments[0] ?? 'Dashboard'
  return [{ label }]
}

export function TopBar() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const isProjectRoute = segments[0] === 'projects' && segments.length >= 3
  const projectId = segments[0] === 'projects' && segments.length >= 2 ? segments[1] : null
  const project = useProject(projectId ?? '')

  const breadcrumbItems = buildBreadcrumbs(pathname)

  if (project && breadcrumbItems.length >= 2 && breadcrumbItems[1].label === projectId) {
    breadcrumbItems[1] = { label: project.name, href: breadcrumbItems[1].href }
  }

  return (
    <div className="h-16 flex items-center justify-between px-6 bg-surface border-b border-border shadow-sm">
      <div className="flex-1 min-w-0">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {isProjectRoute && project && (
          <div className="flex items-center gap-1.5 text-xs text-muted border-r border-border pr-4 mr-1">
            <div
              className={`w-2 h-2 rounded-full ${healthColor(project.healthScore)}`}
              aria-hidden="true"
            />
            <span className="truncate max-w-[120px] font-medium">{project.name}</span>
          </div>
        )}

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

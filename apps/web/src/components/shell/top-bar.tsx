'use client'

import { usePathname } from 'next/navigation'
import { MagnifyingGlass } from '@phosphor-icons/react'
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
    // We'll render project name inside a Client Component, so use projectId as label for now
    // and the TopBar will override with the real name below
    items.push({ label: projectId, href: `/projects/${projectId}` })

    if (segments.length >= 3) {
      const sectionLabel = ROUTE_LABELS[segments[2]] ?? segments[2]
      items.push({ label: sectionLabel })
    }

    if (segments.length >= 4 && segments[3] !== 'new') {
      // Sub-page like runs/[runId], suites/[suiteId]
      const subLabel = ROUTE_LABELS[segments[2]] ?? segments[2]
      // Replace the section with details
      items.length = 2
      items.push({ label: subLabel, href: `/projects/${projectId}/${segments[2]}` })
      items.push({ label: segments[3].slice(0, 20) })
    }

    return items
  }

  // Top-level routes
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

  // Replace projectId label with real project name if available
  if (project && breadcrumbItems.length >= 2 && breadcrumbItems[1].label === projectId) {
    breadcrumbItems[1] = { label: project.name, href: breadcrumbItems[1].href }
  }

  return (
    <div className="h-9 flex items-center gap-2 px-3 bg-surface border-b border-border">
      <div className="flex-1 min-w-0">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      {isProjectRoute && project && (
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <div
            className={`w-2 h-2 rounded-full ${healthColor(project.healthScore)}`}
            aria-hidden="true"
          />
          <span className="text-muted truncate max-w-[120px]">{project.name}</span>
        </div>
      )}

      <button
        aria-label="Search"
        className="flex items-center gap-1.5 h-6 px-2.5 text-xs text-muted bg-canvas border border-border rounded shrink-0"
      >
        <MagnifyingGlass size={12} />
        <span>⌘K</span>
      </button>

      <div
        aria-label="User menu"
        className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-fg text-[10px] font-bold select-none shrink-0"
      >
        IF
      </div>
    </div>
  )
}

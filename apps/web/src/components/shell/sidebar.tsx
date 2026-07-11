'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Gauge,
  FolderOpen,
  TestTube,
  Play,
  ChartBar,
  Sparkle,
  Gear,
  CaretDown,
  Buildings,
} from '@phosphor-icons/react'
import { useProject, useOrg } from '@/lib/use-mock-store'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
}

function healthColor(score: number): string {
  if (score >= 80) return 'bg-pass'
  if (score >= 50) return 'bg-warn'
  return 'bg-fail'
}

export function Sidebar() {
  const pathname = usePathname()
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId = projectMatch?.[1] ?? null
  const org = useOrg()

  // If a project dynamic path is active, show the project-specific nav layout
  if (projectId && projectId !== 'new') {
    return <ProjectSidebar projectId={projectId} pathname={pathname} org={org} />
  }

  // Otherwise, show the global organization-wide navigation.
  // Project-internal items (Suites, Runs, Pipelines, Reports, AI Review)
  // belong ONLY in ProjectSidebar, never here.
  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: Gauge },
    { label: 'Projects', href: '/projects', icon: FolderOpen },
    { label: 'Settings', href: '/settings', icon: Gear },
  ]

  return (
    <aside className="w-52 h-full bg-sidebar flex flex-col shrink-0 text-sidebar-fg">
      {/* Header / Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border-sidebar">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-fg text-xs font-bold shrink-0 shadow-sm" aria-hidden="true">
          Q
        </div>
        <span className="text-sidebar-fg text-lg font-bold tracking-tight">Qably</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 py-4 px-2 overflow-y-auto flex-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/settings' && item.href !== '/projects' && pathname.startsWith(item.href))
          return (
            <SidebarItem
              key={item.label}
              item={item}
              active={isActive}
            />
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-2 p-3 border-t border-border-sidebar mt-auto bg-black/10">
        {/* Organization dropdown card */}
        <button
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-border-sidebar hover:bg-sidebar-hover transition-colors text-left cursor-pointer"
          aria-label="Select organization"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-sidebar-fg-muted shrink-0">
              <Buildings size={12} />
            </div>
            <span className="text-xs font-medium text-sidebar-fg truncate">{org.name || 'Organization'}</span>
          </div>
          <CaretDown size={12} className="text-sidebar-fg-muted shrink-0" />
        </button>

        {/* User profile card */}
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <div className="w-7 h-7 rounded-full bg-primary/25 border border-primary/35 flex items-center justify-center text-primary-fg text-xs font-bold shrink-0">
            IF
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-sidebar-fg truncate">Isaac F.</div>
            <div className="text-[10px] text-sidebar-fg-muted truncate">Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function ProjectSidebar({ projectId, pathname, org }: { projectId: string; pathname: string; org: any }) {
  const project = useProject(projectId)

  const projectNavItems = [
    { label: 'Suites', href: '', icon: TestTube },
    { label: 'Runs', href: 'runs', icon: Play },
    { label: 'Reports', href: 'reports', icon: ChartBar },
    { label: 'AI Review', href: 'ai-review', icon: Sparkle },
  ]

  return (
    <aside className="w-52 h-full bg-sidebar flex flex-col shrink-0 text-sidebar-fg">
      {/* Header / Back Link */}
      <div className="flex flex-col gap-2 p-4 border-b border-border-sidebar">
        <Link
          href="/projects"
          className="text-xs font-semibold text-sidebar-fg-muted hover:text-sidebar-fg transition-colors inline-flex items-center gap-1"
        >
          ← Projects
        </Link>
        
        {/* Project Name Card */}
        <div className="mt-1 rounded-lg bg-white/5 border border-border-sidebar/40 px-3 py-2 flex items-center gap-2">
          {project ? (
            <>
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${healthColor(project.healthScore)}`}
                aria-hidden="true"
              />
              <div className="text-sidebar-fg text-xs font-semibold truncate">
                {project.name}
              </div>
            </>
          ) : (
            <>
              <div className="text-sidebar-fg text-xs font-semibold truncate">{projectId}</div>
              <div className="text-sidebar-fg-muted text-[10px]">Loading…</div>
            </>
          )}
        </div>
      </div>

      {/* Project Navigation */}
      <nav className="flex flex-col gap-0.5 py-4 px-2 overflow-y-auto flex-1">
        {projectNavItems.map(item => {
          // Empty href means "project home" — the suites list is the project home.
          const href = item.href ? `/projects/${projectId}/${item.href}` : `/projects/${projectId}`
          const isActive: boolean =
            pathname === href || (item.href !== '' && pathname.startsWith(href))
          return (
            <SidebarItem
              key={item.label}
              item={{ ...item, href }}
              active={isActive}
            />
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-2 p-3 border-t border-border-sidebar mt-auto bg-black/10">
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <div className="w-7 h-7 rounded-full bg-primary/25 border border-primary/35 flex items-center justify-center text-primary-fg text-xs font-bold shrink-0">
            IF
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-sidebar-fg truncate">Isaac F.</div>
            <div className="text-[10px] text-sidebar-fg-muted truncate">Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150',
        active
          ? 'bg-sidebar-active text-sidebar-fg'
          : 'text-sidebar-fg-muted hover:text-sidebar-fg hover:bg-sidebar-hover',
      ].join(' ')}
    >
      <Icon size={18} weight={active ? 'bold' : 'regular'} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary-fg animate-pulse">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

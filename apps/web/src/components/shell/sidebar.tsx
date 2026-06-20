'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Gauge,
  FolderOpen,
  TestTube,
  Play,
  GitBranch,
  ChartBar,
  Sparkle,
} from '@phosphor-icons/react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const GLOBAL_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Gauge },
  { label: 'Projects', href: '/projects', icon: FolderOpen },
]

const PROJECT_NAV: NavItem[] = [
  { label: 'Suites', href: 'suites', icon: TestTube },
  { label: 'Runs', href: 'runs', icon: Play },
  { label: 'Pipelines', href: 'pipelines', icon: GitBranch },
  { label: 'Reports', href: 'reports', icon: ChartBar },
  { label: 'AI Review', href: 'ai-review', icon: Sparkle },
]

export function Sidebar() {
  const pathname = usePathname()
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId = projectMatch?.[1] ?? null

  return (
    <aside className="w-40 h-full bg-sidebar flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-sidebar">
        <div className="w-4 h-4 rounded bg-primary shrink-0" aria-hidden="true" />
        <span className="text-sidebar-fg text-xs font-semibold">Qably</span>
      </div>

      {projectId ? (
        <ProjectNav projectId={projectId} pathname={pathname} />
      ) : (
        <GlobalNav pathname={pathname} />
      )}

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border-sidebar mt-auto">
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-fg text-[9px] font-bold shrink-0">
          IF
        </div>
        <span className="text-sidebar-fg-muted text-[11px] truncate">Isaac F.</span>
      </div>
    </aside>
  )
}

function GlobalNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col py-1">
      {GLOBAL_NAV.map(item => (
        <SidebarItem
          key={item.href}
          item={item}
          active={pathname === item.href || pathname.startsWith(item.href + '/')}
        />
      ))}
    </nav>
  )
}

function ProjectNav({ projectId, pathname }: { projectId: string; pathname: string }) {
  return (
    <>
      <Link
        href="/projects"
        className="px-3 pt-2.5 pb-1 text-[11px] text-sidebar-fg-muted hover:text-sidebar-fg transition-colors"
      >
        ← Projects
      </Link>

      <div className="mx-2 mb-1 rounded bg-white/5 px-2 py-1.5">
        <div className="text-sidebar-fg text-[11px] font-semibold truncate">{projectId}</div>
        <div className="text-sidebar-fg-muted text-[9px] mt-0.5">Loading…</div>
      </div>

      <nav className="flex flex-col py-1">
        {PROJECT_NAV.map(item => {
          const href = `/projects/${projectId}/${item.href}`
          return (
            <SidebarItem
              key={item.href}
              item={{ ...item, href }}
              active={pathname.startsWith(href)}
            />
          )
        })}
      </nav>
    </>
  )
}

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors',
        active
          ? 'bg-sidebar-active text-sidebar-fg border-l-2 border-primary'
          : 'text-sidebar-fg-muted hover:text-sidebar-fg hover:bg-sidebar-hover',
      ].join(' ')}
    >
      <Icon size={13} weight={active ? 'bold' : 'regular'} aria-hidden="true" />
      {item.label}
    </Link>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Buildings,
  CaretDown,
  Gauge,
  FolderOpen,
  Gear,
  Plug,
  Stack,
  Play,
  Robot,
  ChartLine,
  ArrowLeft,
} from '@phosphor-icons/react'
import { useOrg, useProject } from '@/lib/use-mock-store'
import { useTranslation } from '@/lib/i18n'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

export function Sidebar() {
  const pathname = usePathname()
  const org = useOrg()
  const { t } = useTranslation()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Project context: when inside a project page (/projects/[id]/...),
  // render the project's sub-routes in addition to the global nav.
  const segments = pathname.split('/').filter(Boolean)
  const projectId = segments[0] === 'projects' && segments.length >= 2 ? segments[1] : null
  const project = useProject(projectId ?? '')

  const navItems: NavItem[] = [
    { label: t('sidebar.dashboard'), href: '/dashboard', icon: Gauge },
    { label: t('sidebar.projects'), href: '/projects', icon: FolderOpen },
    { label: t('sidebar.integrations'), href: '/integrations', icon: Plug },
  ]

  // Project-internal sub-routes. Each links to a project-scoped page.
  // "Suites" → /projects/[id] (Phase 1.7: project home collapsed into suites list)
  const projectSubItems: NavItem[] = projectId
    ? [
        { label: t('sidebar.suites'), href: `/projects/${projectId}`, icon: Stack },
        { label: t('sidebar.runs'), href: `/projects/${projectId}/runs`, icon: Play },
        { label: t('sidebar.aiReview'), href: `/projects/${projectId}/ai-review`, icon: Robot },
        { label: t('sidebar.reports'), href: `/projects/${projectId}/reports`, icon: ChartLine },
      ]
    : []

  return (
    <ShadcnSidebar collapsible="icon" className="bg-sidebar">
      <SidebarHeader className="p-3 border-b border-border-sidebar">
        {!isCollapsed && (
          <button
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-border-sidebar hover:bg-sidebar-hover transition-colors text-left cursor-pointer"
            aria-label="Select organization"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-sidebar-fg-muted shrink-0">
                <Buildings size={14} />
              </div>
              <span className="text-sm font-medium text-sidebar-foreground truncate">{org.name || t('sidebar.organization')}</span>
            </div>
            <CaretDown size={14} className="text-sidebar-fg-muted shrink-0" />
          </button>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Project context (only when inside a project) — Linear-style:
            single muted row with chevron + project name as the back link. */}
        {projectId && project && !isCollapsed && (
          <SidebarGroup className="px-2 pt-2">
            <Link
              href="/projects"
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-sidebar-fg-muted hover:text-sidebar-foreground transition-colors"
            >
              <ArrowLeft size={12} aria-hidden="true" />
              <span className="truncate font-medium">{project.name}</span>
            </Link>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectSubItems.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        tooltip={item.label}
                        className="h-8 text-sm"
                      >
                        <item.icon size={16} weight={isActive ? 'bold' : 'regular'} aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Global nav */}
        <SidebarGroup className="px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-10 text-base"
                    >
                      <item.icon size={22} weight={isActive ? 'bold' : 'regular'} aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border-sidebar bg-black/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname === '/settings'}
              tooltip={t('sidebar.settings')}
              className="h-10 text-base"
            >
              <Gear size={22} weight={pathname === '/settings' ? 'bold' : 'regular'} aria-hidden="true" />
              <span>{t('sidebar.settings')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {isCollapsed ? (
          <div className="flex items-center justify-center py-2">
            <div className="w-8 h-8 rounded-full bg-primary/25 border border-primary/35 flex items-center justify-center text-primary-fg text-sm font-bold shrink-0">
              IF
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-2 mt-2">
            <div className="w-8 h-8 rounded-full bg-primary/25 border border-primary/35 flex items-center justify-center text-primary-fg text-sm font-bold shrink-0">
              IF
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">Isaac F.</div>
              <div className="text-sm text-sidebar-fg-muted truncate">{t('sidebar.admin')}</div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </ShadcnSidebar>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Buildings,
  Gauge,
  FolderOpen,
  Gear,
  Stack,
  Play,
  Robot,
  ChartLine,
  Tray,
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
  exact?: boolean
}

export function Sidebar() {
  const pathname = usePathname()
  const org = useOrg()
  const { t } = useTranslation()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Project routes replace, rather than append to, global navigation.
  const segments = pathname.split('/').filter(Boolean)
  const projectId = segments[0] === 'projects' && segments.length >= 2 ? segments[1] : null
  const project = useProject(projectId ?? '')
  const projectContext = project ? projectId : null

  const navItems: NavItem[] = [
    { label: t('sidebar.portfolio'), href: '/dashboard', icon: Gauge },
    { label: t('sidebar.projects'), href: '/projects', icon: FolderOpen },
    { label: t('sidebar.reviewInbox'), href: '/review-inbox', icon: Tray },
    { label: t('sidebar.notifications'), href: '/notifications', icon: Bell },
    { label: t('sidebar.settings'), href: '/settings', icon: Gear },
  ]

  const projectSubItems: NavItem[] = projectContext
    ? [
        { label: t('sidebar.overview'), href: `/projects/${projectContext}`, icon: Gauge, exact: true },
        { label: t('sidebar.repository'), href: `/projects/${projectContext}/repository`, icon: FolderOpen },
        { label: t('sidebar.review'), href: `/projects/${projectContext}/ai-review`, icon: Robot },
        { label: t('sidebar.testLibrary'), href: `/projects/${projectContext}/suites`, icon: Stack },
        { label: t('sidebar.runs'), href: `/projects/${projectContext}/runs`, icon: Play },
        { label: t('sidebar.quality'), href: `/projects/${projectContext}/reports`, icon: ChartLine },
      ]
    : []

  return (
    <ShadcnSidebar collapsible="icon" className="bg-sidebar">
      <nav aria-label="Sidebar" className="flex h-full flex-col">
      <SidebarHeader className="h-14 justify-center p-2">
        {!isCollapsed && (
          <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-border-sidebar px-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-sidebar-active text-sidebar-fg-muted">
                <Buildings size={14} />
              </div>
              <span className="text-sm font-medium text-sidebar-foreground truncate">{org.name || t('sidebar.organization')}</span>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* The project identity also serves as the only route back to global projects. */}
        {projectContext && project && (
          <SidebarGroup className="px-2 pt-2">
            <Link
              href="/projects"
              aria-label={`${t('sidebar.projects')}: ${project.name}`}
              className="flex min-h-10 items-center gap-1.5 px-2 text-base font-normal text-sidebar-fg-muted transition-colors hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ArrowLeft size={18} weight="regular" aria-hidden="true" />
              {!isCollapsed && <><span>{t('sidebar.projects')}</span><span aria-hidden="true">/</span><span className="truncate">{project.name}</span></>}
            </Link>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectSubItems.map(item => {
                  const isActive = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'))
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        render={<Link href={item.href} aria-current={isActive ? 'page' : undefined} />}
                        isActive={isActive}
                        tooltip={item.label}
                        className="h-10 text-base font-normal"
                      >
                        <item.icon size={20} weight="regular" aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Global nav is only available outside a project context. */}
        {!projectContext && <SidebarGroup className="px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = !projectContext && (pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/')))
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      render={<Link href={item.href} aria-current={isActive ? 'page' : undefined} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-10 text-base"
                    >
                      <item.icon size={20} weight="regular" aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}
      </SidebarContent>

       <SidebarFooter className="border-t border-border-sidebar p-3">
        {isCollapsed ? (
          <div className="flex items-center justify-center py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-sidebar bg-primary text-sm font-normal text-primary-fg">
              IF
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-2 mt-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-sidebar bg-primary text-sm font-normal text-primary-fg">
              IF
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-normal text-sidebar-foreground">Isaac F.</div>
              <div className="truncate text-sm text-sidebar-fg-muted">{t('sidebar.admin')}</div>
            </div>
          </div>
        )}
      </SidebarFooter>
      </nav>
    </ShadcnSidebar>
  )
}

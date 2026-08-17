'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BellSimple,
  SquaresFour,
  FolderSimple,
  GearSix,
  Stack,
  Play,
  Robot,
  ChartLine,
  Tray,
  CaretLeft,
} from '@phosphor-icons/react'
import { useProject } from '@/lib/use-mock-store'
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  exact?: boolean
  aliasHref?: string
}

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Project routes replace, rather than append to, global navigation.
  const segments = pathname.split('/').filter(Boolean)
  const projectId = segments[0] === 'projects' && segments.length >= 2 ? segments[1] : null
  const project = useProject(projectId ?? '')
  const projectContext = project ? projectId : null

  const navItems: NavItem[] = [
    { label: t('sidebar.portfolio'), href: '/dashboard', icon: SquaresFour },
    { label: t('sidebar.projects'), href: '/projects', icon: FolderSimple },
    { label: t('sidebar.reviewInbox'), href: '/review-inbox', icon: Tray },
    { label: t('sidebar.notifications'), href: '/notifications', icon: BellSimple },
    { label: t('sidebar.settings'), href: '/settings', icon: GearSix },
  ]

  const projectSubItems: NavItem[] = projectContext
    ? [
        { label: t('sidebar.repository'), href: `/projects/${projectContext}/repository`, icon: FolderSimple },
        { label: t('sidebar.review'), href: `/projects/${projectContext}/ai-review`, icon: Robot },
        {
          label: t('sidebar.testLibrary'),
          href: `/projects/${projectContext}/suites`,
          icon: Stack,
          // The project root renders the same suite list, so it counts as this item too.
          aliasHref: `/projects/${projectContext}`,
        },
        { label: t('sidebar.runs'), href: `/projects/${projectContext}/runs`, icon: Play },
        { label: t('sidebar.quality'), href: `/projects/${projectContext}/reports`, icon: ChartLine },
      ]
    : []

  return (
    <ShadcnSidebar variant="sidebar" collapsible="icon" className="border-r-0! bg-sidebar">
      <nav aria-label="Sidebar" className="flex h-full flex-col">
      <SidebarHeader className="h-14 justify-center p-2">
        {isCollapsed ? (
          <div className="flex items-center justify-center">
            <SidebarTrigger className="shrink-0" />
          </div>
        ) : (
          <div className="flex h-10 w-full items-center justify-between gap-1.5 px-0.5">
            <Link
              href="/dashboard"
              aria-label="Qably"
              className="flex h-10 flex-1 items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary min-w-0"
            >
              <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-fg shadow-xs">
                Q
              </span>
              <span className="truncate text-sm font-semibold tracking-[-0.015em] text-sidebar-foreground">Qably</span>
            </Link>
            <SidebarTrigger className="shrink-0 text-sidebar-fg-muted hover:text-sidebar-foreground hover:bg-sidebar-hover" />
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
              className="flex min-h-9 items-center gap-1.5 px-2 text-sm font-normal text-sidebar-fg-muted transition-colors hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <CaretLeft size={18} weight="bold" aria-hidden="true" />
              {!isCollapsed && <><span>{t('sidebar.projects')}</span><span aria-hidden="true">/</span><span className="truncate">{project.name}</span></>}
            </Link>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectSubItems.map(item => {
                  const isActive =
                    pathname === item.href ||
                    pathname === item.aliasHref ||
                    (!item.exact && pathname.startsWith(item.href + '/'))
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        render={<Link href={item.href} aria-current={isActive ? 'page' : undefined} />}
                        isActive={isActive}
                        tooltip={item.label}
                        className="h-9 text-sm font-normal"
                      >
                        <item.icon size={18} weight="regular" aria-hidden="true" />
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
                      className="h-9 text-sm"
                    >
                      <item.icon size={18} weight="regular" aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}
      </SidebarContent>

       <SidebarFooter className="p-2">
        {isCollapsed ? (
          <div className="flex items-center justify-center py-1">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-fg shadow-xs"
              title="Isaac F. (Admin)"
              aria-label="Isaac F."
            >
              IF
            </div>
          </div>
        ) : (
          <div
            data-slot="sidebar-account"
            className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-border-sidebar bg-sidebar/50 px-3 py-2 transition-colors hover:bg-sidebar-hover"
          >
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-fg shadow-xs"
            >
              IF
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-tight text-sidebar-foreground">Isaac F.</div>
              <div className="truncate text-xs leading-normal text-sidebar-fg-muted">{t('sidebar.admin')}</div>
            </div>
          </div>
        )}
      </SidebarFooter>
      </nav>
    </ShadcnSidebar>
  )
}

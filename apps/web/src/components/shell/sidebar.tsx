'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  SquaresFour,
  FolderSimple,
  BellSimple,
  GearSix,
  Play,
  ChartLine,
  Sparkle,
  Stack,
  Tray,
  CaretLeft,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { SidebarAccount } from '@/components/shell/sidebar-account'
import { useProject } from '@/lib/use-mock-store'
import { useTranslation } from '@/lib/i18n'

interface NavItem {
  label: string
  href: string
  icon: Icon
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
        { label: t('sidebar.review'), href: `/projects/${projectContext}/ai-review`, icon: Sparkle },
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
              className="flex h-10 flex-1 items-center rounded-lg px-2 transition-colors hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary min-w-0"
            >
              <Image
                src="/qably-sidebar.svg"
                alt="Qably"
                width={416}
                height={126}
                className="h-7 w-auto object-contain translate-y-0.5"
                priority
              />
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
              {!isCollapsed && <span className="truncate">{project.name}</span>}
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
                        tooltip={isCollapsed ? item.label : undefined}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Global navigation items when not in project context */}
        {!projectContext && <SidebarGroup className="px-2 pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      render={<Link href={item.href} aria-current={isActive ? 'page' : undefined} />}
                      isActive={isActive}
                      tooltip={isCollapsed ? item.label : undefined}
                    >
                      <item.icon aria-hidden="true" />
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
        <SidebarAccount name="Isaac F." role={t('sidebar.admin')} initials="IF" collapsed={isCollapsed} />
      </SidebarFooter>
      </nav>
    </ShadcnSidebar>
  )
}

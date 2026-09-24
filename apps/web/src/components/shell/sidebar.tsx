'use client'

import { useEffect } from 'react'
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
  ChatsCircle,
  Stack,
  Tray,
  CaretLeft,
  Key,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { OrgRole } from '@qably/types'
import { SidebarAccount } from '@/components/shell/sidebar-account'
import { useCurrentUser } from '@/features/auth/hooks/use-current-user'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'
import { useProject } from '@/features/projects/hooks/use-project'
import { useProjectRouteId } from '@/features/projects/hooks/use-project-route-id'
import {
  projectAerisPath,
  projectQualityPath,
  projectRootPath,
  projectSuitesPath,
} from '@/features/projects/lib/routes'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: Icon
  exact?: boolean
}

const ROLE_LABEL_KEYS: Record<OrgRole, string> = {
  owner: 'settings.members.roleOwner',
  admin: 'settings.members.roleAdmin',
  member: 'settings.members.roleMember',
}

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const currentUser = useCurrentUser()
  const { organization: currentOrganization } = useCurrentOrganization()
  const isCollapsed = state === 'collapsed'

  const projectId = useProjectRouteId()
  const { project } = useProject(projectId ?? '')
  const projectContext = project ? projectId : null

  // Route changes on mobile should dismiss the sheet — otherwise it stays
  // open over the newly navigated page until the user closes it manually.
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  const navItems: NavItem[] = [
    { label: t('sidebar.portfolio'), href: '/dashboard', icon: SquaresFour },
    { label: t('sidebar.projects'), href: '/projects', icon: FolderSimple },
    { label: t('sidebar.reviewInbox'), href: '/review-inbox', icon: Tray },
    { label: t('sidebar.notifications'), href: '/notifications', icon: BellSimple },
    { label: t('sidebar.settings'), href: '/settings', icon: GearSix },
  ]

  const projectSubItems: NavItem[] = projectContext
    ? [
        { label: t('sidebar.repository'), href: projectRootPath(projectContext), icon: FolderSimple },
        { label: t('sidebar.aerisChat'), href: projectAerisPath(projectContext), icon: ChatsCircle },
        { label: t('sidebar.testLibrary'), href: projectSuitesPath(projectContext), icon: Stack },
        { label: t('sidebar.runs'), href: `/projects/${projectContext}/runs`, icon: Play },
        { label: t('sidebar.quality'), href: projectQualityPath(projectContext), icon: ChartLine },
        { label: t('sidebar.apiKeys'), href: `/projects/${projectContext}/api-keys`, icon: Key },
      ]
    : []

  return (
    <ShadcnSidebar variant="sidebar" collapsible="icon" className="border-r-0! bg-sidebar">
      <nav aria-label="Sidebar" className="flex h-full flex-col">
      <SidebarHeader className={cn('justify-center p-2', isCollapsed ? undefined : 'h-14')}>
        {isCollapsed ? (
          <>
            <Link
              href="/dashboard"
              aria-label="Qably"
              className="mx-auto flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Image
                src="/icono-qably.png"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                priority
              />
            </Link>
            <div className="flex items-center justify-center">
              <SidebarTrigger className="shrink-0" />
            </div>
          </>
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
              className="flex min-h-9 items-center gap-1.5 px-2 text-xs font-medium text-sidebar-fg-muted transition-all duration-150 active:scale-[0.98] hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <CaretLeft size={18} weight="bold" aria-hidden="true" />
              {!isCollapsed && <span className="truncate">{project.name}</span>}
            </Link>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectSubItems.map(item => {
                  const isActive =
                    pathname === item.href ||
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
        <SidebarAccount
          name={currentUser.name}
          image={currentUser.image}
          role={currentOrganization ? t(ROLE_LABEL_KEYS[currentOrganization.role]) : ''}
          collapsed={isCollapsed}
        />
      </SidebarFooter>
      </nav>
    </ShadcnSidebar>
  )
}

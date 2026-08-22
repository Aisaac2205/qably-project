'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretUpDown, SignOut } from '@phosphor-icons/react'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useTranslation } from '@/lib/i18n'

const LOGIN_ROUTE = '/login'

interface SidebarAccountProps {
  name: string
  role: string
  initials: string
  collapsed: boolean
}

export function SidebarAccount({ name, role, initials, collapsed }: SidebarAccountProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { logout } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    setError(null)

    const outcome = await logout()

    if (outcome.error) {
      setError(outcome.error)
      setIsSigningOut(false)
      return
    }

    router.replace(LOGIN_ROUTE)
    router.refresh()
  }

  const triggerClassName = collapsed
    ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg shadow-xs transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
    : 'flex h-12 w-full items-center gap-2.5 rounded-xl border border-border-sidebar bg-sidebar/50 px-3 py-2 text-left transition-colors hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

  return (
    <div className={collapsed ? 'flex flex-col items-center gap-1.5 py-1' : 'flex flex-col gap-1.5'}>
      <Menu>
        <MenuTrigger
          data-slot="sidebar-account"
          aria-label={collapsed ? `${name}, ${role}` : undefined}
          className={triggerClassName}
        >
          {collapsed ? (
            initials
          ) : (
            <>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg shadow-xs"
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight text-sidebar-foreground">{name}</span>
                <span className="block truncate text-xs leading-normal text-sidebar-fg-muted">{role}</span>
              </span>
              <CaretUpDown size={16} aria-hidden="true" className="shrink-0 text-sidebar-fg-muted" />
            </>
          )}
        </MenuTrigger>

        <MenuPortal>
          <MenuPositioner side="top" align={collapsed ? 'center' : 'start'}>
            <MenuContent className="w-56">
              <MenuItem
                closeOnClick={false}
                disabled={isSigningOut}
                onClick={handleSignOut}
                className="gap-2 px-2.5 py-2 text-sm text-default"
              >
                <SignOut size={16} aria-hidden="true" className="shrink-0" />
                {isSigningOut ? t('sidebar.signingOut') : t('sidebar.signOut')}
              </MenuItem>
            </MenuContent>
          </MenuPositioner>
        </MenuPortal>
      </Menu>

      {error && (
        <p role="alert" className="px-1 text-xs leading-normal text-fail">
          {error}
        </p>
      )}
    </div>
  )
}

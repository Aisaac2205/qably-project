import { useEffect, useRef, type ReactNode } from 'react'
import {
  CircleNotch,
  FolderOpen,
  LockKey,
  Prohibit,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export type StateViewKind = 'loading' | 'empty' | 'error' | 'no-permission' | 'no-source' | 'blocked'

const STATE_ICONS = {
  loading: CircleNotch,
  empty: FolderOpen,
  error: XCircle,
  'no-permission': LockKey,
  'no-source': WarningCircle,
  blocked: Prohibit,
} as const

export interface StateViewProps {
  kind: StateViewKind
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  focusOnMount?: boolean
  onAutofocus?: () => void
}

export function StateView({ kind, title, description, action, className, focusOnMount = false, onAutofocus }: StateViewProps) {
  const Icon = STATE_ICONS[kind]
  const isLoading = kind === 'loading'
  const isError = kind === 'error'
  const stateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusOnMount) return
    stateRef.current?.focus()
    onAutofocus?.()
  }, [focusOnMount, onAutofocus])

  return (
    <div
      ref={stateRef}
      className={cn('flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-10 text-center', className)}
      data-state-kind={kind}
      role={isLoading ? 'status' : isError ? 'alert' : undefined}
      aria-live={isLoading ? 'polite' : undefined}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      <Icon size={28} weight="duotone" className={cn('text-muted', isLoading && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-default">{title}</p>
        {description ? <p className="mt-1 max-w-md text-sm text-muted text-wrap-pretty">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

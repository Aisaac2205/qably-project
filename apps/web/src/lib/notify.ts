import { toast } from 'sonner'

export interface NotifyAction {
  label: string
  onClick: () => void
}

export interface NotifyOptions {
  description?: string
  /** A button on the toast. Pressing it also dismisses the toast. */
  action?: NotifyAction
  /** Names the toast: calling again with the same id updates it instead of stacking a second one. */
  id?: string
}

/**
 * The shared Toaster is unstyled and styles no action button, so the button
 * carries the same outlined small-button look as the rest of the product. Its
 * focus is a ring: the stylesheet strips the outline of every <button>.
 */
const ACTION_BUTTON_CLASS =
  'inline-flex h-8 shrink-0 cursor-pointer items-center self-center rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-default transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary active:translate-y-px md:h-7'

function toToastOptions(options?: NotifyOptions) {
  if (options === undefined) return undefined

  const { description, action, id } = options
  const result = {
    ...(description === undefined ? {} : { description }),
    ...(id === undefined ? {} : { id }),
    ...(action === undefined
      ? {}
      : {
          action: { label: action.label, onClick: action.onClick },
          classNames: { actionButton: ACTION_BUTTON_CLASS },
        }),
  }

  return Object.keys(result).length === 0 ? undefined : result
}

export const notify = {
  success(title: string, options?: NotifyOptions) {
    return toast.success(title, toToastOptions(options))
  },
  info(title: string, options?: NotifyOptions) {
    return toast.info(title, toToastOptions(options))
  },
  warning(title: string, options?: NotifyOptions) {
    return toast.warning(title, toToastOptions(options))
  },
  error(title: string, options?: NotifyOptions) {
    return toast.error(title, { ...toToastOptions(options), duration: Infinity })
  },
  dismiss(id?: number | string) {
    return toast.dismiss(id)
  },
}

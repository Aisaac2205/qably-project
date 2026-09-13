import { toast } from 'sonner'

export interface NotifyOptions {
  description?: string
}

function withDescription(options?: NotifyOptions) {
  return options?.description === undefined
    ? undefined
    : { description: options.description }
}

export const notify = {
  success(title: string, options?: NotifyOptions) {
    return toast.success(title, withDescription(options))
  },
  info(title: string, options?: NotifyOptions) {
    return toast.info(title, withDescription(options))
  },
  warning(title: string, options?: NotifyOptions) {
    return toast.warning(title, withDescription(options))
  },
  error(title: string, options?: NotifyOptions) {
    return toast.error(title, { ...withDescription(options), duration: Infinity })
  },
  dismiss(id?: number | string) {
    return toast.dismiss(id)
  },
}

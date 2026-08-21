import { WarningCircle } from '@phosphor-icons/react'

interface AuthFormErrorProps {
  id: string
  message: string
}

export function AuthFormError({ id, message }: AuthFormErrorProps) {
  return (
    <div
      id={id}
      role="alert"
      className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md px-3 py-2.5 text-sm"
    >
      <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

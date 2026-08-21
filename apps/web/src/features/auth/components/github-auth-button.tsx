import { CircleNotch } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { GithubMark } from '@/features/auth/components/brand-marks'

interface GithubAuthButtonProps {
  label: string
  disabled?: boolean
  pending?: boolean
  onClick?: () => void
}

export function GithubAuthButton({
  label,
  disabled,
  pending,
  onClick,
}: GithubAuthButtonProps) {
  return (
    <Button
      className="flex gap-2"
      variant="outline"
      size="lg"
      type="button"
      disabled={disabled || pending}
      onClick={onClick}
    >
      {pending ? (
        <CircleNotch
          className="size-4 animate-spin motion-reduce:animate-none"
          weight="bold"
          aria-hidden="true"
        />
      ) : (
        <GithubMark className="size-4" />
      )}
      <span>{pending ? 'Redirecting to GitHub…' : label}</span>
    </Button>
  )
}

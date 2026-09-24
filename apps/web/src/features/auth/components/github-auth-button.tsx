import Image from 'next/image'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

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
        <Spinner />
      ) : (
        <Image src="/logos/github.svg" alt="" width={16} height={16} aria-hidden="true" />
      )}
      <span>{pending ? 'Redirecting to GitHub…' : label}</span>
    </Button>
  )
}

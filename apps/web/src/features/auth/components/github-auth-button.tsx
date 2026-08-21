import { Button } from '@/components/ui/button'
import { GithubMark } from '@/features/auth/components/brand-marks'

interface GithubAuthButtonProps {
  label: string
  disabled?: boolean
}

export function GithubAuthButton({ label, disabled }: GithubAuthButtonProps) {
  return (
    <Button
      className="flex gap-2"
      variant="outline"
      size="lg"
      type="button"
      disabled={disabled}
    >
      <GithubMark className="size-4" />
      <span>{label}</span>
    </Button>
  )
}

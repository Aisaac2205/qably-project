import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface BitbucketAuthButtonProps {
  label: string
  comingSoonLabel: string
}

export function BitbucketAuthButton({
  label,
  comingSoonLabel,
}: BitbucketAuthButtonProps) {
  return (
    <Button className="flex gap-2" variant="outline" size="lg" type="button" disabled>
      <Image
        src="/logos/bitbucket.svg"
        alt=""
        width={16}
        height={16}
        aria-hidden="true"
      />
      <span>{label}</span>{' '}
      <Badge variant="outline" className="ml-auto">
        {comingSoonLabel}
      </Badge>
    </Button>
  )
}

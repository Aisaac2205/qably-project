import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LoadMoreLabels {
  load: string
  loading: string
  retry: string
  error: string
}

interface LoadMoreProps {
  isFetching: boolean
  hasFailed: boolean
  onLoad: (event: MouseEvent<HTMLButtonElement>) => void
  labels: LoadMoreLabels
  className?: string
}

export function LoadMore({ isFetching, hasFailed, onLoad, labels, className }: LoadMoreProps) {
  const showFailure = hasFailed && !isFetching

  return (
    <div className="flex flex-col items-center gap-2">
      {showFailure && (
        <p role="alert" className="text-sm text-fail">
          {labels.error}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className={cn(
          'w-full focus-visible:outline-hidden! focus-visible:ring-primary sm:w-auto',
          className,
        )}
        onClick={onLoad}
        disabled={isFetching}
        focusableWhenDisabled
      >
        {isFetching ? labels.loading : showFailure ? labels.retry : labels.load}
      </Button>
    </div>
  )
}

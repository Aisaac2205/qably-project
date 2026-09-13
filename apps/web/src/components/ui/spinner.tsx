import { cn } from '@/lib/utils'

const SPINNER_SIZES = {
  sm: '0.875rem',
  md: '1rem',
  lg: '1.25rem',
} as const

export type SpinnerSize = keyof typeof SPINNER_SIZES

export interface SpinnerProps extends React.ComponentProps<'span'> {
  size?: SpinnerSize
}

export function Spinner({ size = 'md', className, style, ...props }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('spinner', className)}
      style={{ '--spinner-size': SPINNER_SIZES[size], ...style } as React.CSSProperties}
      {...props}
    >
      <span className="spinner-core" />
      <span className="spinner-marker" />
      <span className="spinner-marker" />
    </span>
  )
}

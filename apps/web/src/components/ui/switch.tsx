'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-canvas p-0.5 shadow-2xs transition-colors outline-none cursor-pointer',
        'data-[checked]:border-primary data-[checked]:bg-primary',
        'focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'block size-4 rounded-full bg-surface shadow-2xs transition-transform',
          'data-[checked]:translate-x-4 data-[unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

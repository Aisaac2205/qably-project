import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-default shadow-xs transition-all duration-150 ease-out outline-none",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-default",
        "placeholder:text-muted",
        "focus:outline-none focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-canvas-hover/40",
        "aria-invalid:border-fail aria-invalid:ring-1 aria-invalid:ring-fail/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }

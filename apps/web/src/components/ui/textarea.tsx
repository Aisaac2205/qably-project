import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-default shadow-xs outline-none transition-all duration-150 ease-out resize-none",
        "placeholder:text-muted",
        "focus:outline-none focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-canvas-hover/40",
        "aria-invalid:border-fail aria-invalid:ring-1 aria-invalid:ring-fail/20",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

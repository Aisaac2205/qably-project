import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded border text-xs font-semibold px-1.5 py-0.5 whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary/10 text-primary border-primary/20",
        pass:        "bg-pass-bg text-pass border-pass/20",
        fail:        "bg-fail-bg text-fail border-fail/20",
        running:     "bg-running-bg text-running border-running/20",
        warn:        "bg-warn-bg text-warn border-warn/20",
        skip:        "bg-skip-bg text-skip border-border",
        outline:     "border-border text-muted bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

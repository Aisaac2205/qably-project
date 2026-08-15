import type { ReactNode, TableHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode
  caption: ReactNode
  wrapperClassName?: string
}

export function DataTable({ children, caption, className, wrapperClassName, ...props }: DataTableProps) {
  return (
    <div className={cn('w-full overflow-x-auto', wrapperClassName)}>
      <table className={cn('w-full border-collapse text-left', className)} {...props}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

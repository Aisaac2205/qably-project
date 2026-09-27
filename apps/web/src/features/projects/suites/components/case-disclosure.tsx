import type { ReactNode } from 'react'
import { CaretRight } from '@phosphor-icons/react'

const TONE_CLASSES = {
  default: 'text-default hover:text-primary bg-canvas/70 border-border/70',
  ai: 'text-ai hover:text-ai bg-ai-bg/40 border-ai/30',
} as const

export interface CaseDisclosureToggleProps {
  label: ReactNode
  isOpen: boolean
  onToggle: () => void
  tone?: keyof typeof TONE_CLASSES
}

export function CaseDisclosureToggle({
  label,
  isOpen,
  onToggle,
  tone = 'default',
}: CaseDisclosureToggleProps) {
  return (
    <button
      onClick={onToggle}
      data-state={isOpen ? 'open' : 'closed'}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 border cursor-pointer transition-[transform,color,background-color] duration-150 ease-out-quart motion-reduce:transition-none active:scale-97 ${TONE_CLASSES[tone]}`}
      aria-expanded={isOpen}
      type="button"
    >
      <CaretRight
        size={13}
        weight="bold"
        aria-hidden="true"
        className={`transition-transform duration-150 ease-out-quart motion-reduce:transition-none ${isOpen ? 'rotate-90' : ''}`}
      />
      {label}
    </button>
  )
}

export interface CaseDisclosurePanelProps {
  isOpen: boolean
  children: ReactNode
}

export function CaseDisclosurePanel({ isOpen, children }: CaseDisclosurePanelProps) {
  if (!isOpen) return null
  return (
    <div data-state="open" className="disclosure-panel">
      {children}
    </div>
  )
}

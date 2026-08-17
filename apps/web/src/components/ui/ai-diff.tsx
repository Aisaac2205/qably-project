'use client'

import { cn } from '@/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

const SPRING_DEFAULT = {
  bounce: 0.1,
  duration: 0.25,
  type: 'spring' as const,
}
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const LINE_STAGGER = 0.02
const WIPE_DURATION = 0.28
const FLASH_DURATION = 0.35
const SUCCESS_TINT = 'oklch(72% 0.17 150 / 0.14)'
const DANGER_TINT = 'oklch(63% 0.21 25 / 0.12)'

export type AIDiffLineKind = 'added' | 'removed' | 'context'

export type AIDiffLine = {
  content: string
  kind: AIDiffLineKind
  /** Line number in the file. Omit for tabular data rather than code. */
  number?: number
}

export type AIDiffProps = {
  className?: string
  lines: AIDiffLine[]
  onAccept?: () => void
  onReject?: () => void
  /** File path or a description of what is being changed. */
  title?: string
}

const PREFIX: Record<AIDiffLineKind, string> = {
  added: '+',
  context: ' ',
  removed: '-',
}

/**
 * A proposed edit awaiting a human yes or no.
 *
 * Added lines wipe in from the left with a clip path rather than fading.
 * Rejecting collapses the lines to zero height so the space is reclaimed.
 */
export function AIDiff({
  className,
  lines,
  onAccept,
  onReject,
  title,
}: AIDiffProps) {
  const shouldReduceMotion = useReducedMotion()
  const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(null)

  const accept = () => {
    setDecision('accepted')
    onAccept?.()
  }

  const reject = () => {
    setDecision('rejected')
    onReject?.()
  }

  const added = lines.filter((line) => line.kind === 'added').length
  const removed = lines.filter((line) => line.kind === 'removed').length

  return (
    <motion.div
      animate={
        decision && !shouldReduceMotion
          ? {
              backgroundColor: [
                decision === 'accepted' ? SUCCESS_TINT : DANGER_TINT,
                'rgb(0 0 0 / 0)',
              ],
            }
          : undefined
      }
      className={cn(
        'w-full overflow-hidden rounded-xl border border-border bg-surface shadow-card',
        className
      )}
      layout={!shouldReduceMotion}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              backgroundColor: { duration: FLASH_DURATION, ease: EASE_OUT },
              layout: SPRING_DEFAULT,
            }
      }
    >
      <div className="flex items-center gap-2 border-b border-border bg-canvas/40 px-3.5 py-2.5">
        {title ? (
          <span className="min-w-0 truncate font-mono text-xs font-medium text-default">
            {title}
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs font-mono tabular-nums">
          <span className="font-semibold text-pass">+{added}</span>
          <span className="font-semibold text-fail">-{removed}</span>
        </span>
      </div>

      <AnimatePresence initial={false}>
        {decision !== 'rejected' && (
          <motion.div
            className="overflow-hidden"
            exit={
              shouldReduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { height: 0, opacity: 0 }
            }
            transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
          >
            <pre className="overflow-x-auto py-2 font-mono text-xs leading-relaxed">
              {lines.map((line, index) => (
                <motion.div
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { clipPath: 'inset(0 0% 0 0)' }
                  }
                  className={cn(
                    'flex gap-3 px-3.5 py-0.5 transition-colors',
                    line.kind === 'added' && 'bg-pass-bg/60 text-pass',
                    line.kind === 'removed' && 'bg-fail-bg/60 text-fail',
                    line.kind === 'context' && 'text-default'
                  )}
                  initial={
                    line.kind === 'added' && !shouldReduceMotion
                      ? { clipPath: 'inset(0 100% 0 0)' }
                      : false
                  }
                  key={index}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          delay: index * LINE_STAGGER,
                          duration: WIPE_DURATION,
                          ease: EASE_OUT,
                        }
                  }
                >
                  {line.number !== undefined && (
                    <span className="w-6 shrink-0 select-none text-right font-mono text-muted tabular-nums">
                      {line.number}
                    </span>
                  )}
                  <span
                    className={cn(
                      'w-2 shrink-0 select-none font-mono font-bold',
                      line.kind === 'added' && 'text-pass',
                      line.kind === 'removed' && 'text-fail',
                      line.kind === 'context' && 'text-muted'
                    )}
                  >
                    {PREFIX[line.kind]}
                  </span>
                  <span className="whitespace-pre">{line.content}</span>
                </motion.div>
              ))}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {(onAccept || onReject) && !decision && (
        <div className="flex items-center justify-end gap-2 border-t border-border bg-canvas/30 px-3.5 py-2.5">
          {onReject ? (
            <button
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-muted transition-all duration-150 active:scale-[0.98] hover:bg-surface-hover hover:text-default focus-visible:outline-2 focus-visible:outline-primary"
              onClick={reject}
              type="button"
            >
              Reject
            </button>
          ) : null}
          {onAccept ? (
            <button
              className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg shadow-sm transition-all duration-150 active:scale-[0.98] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
              onClick={accept}
              type="button"
            >
              Accept
            </button>
          ) : null}
        </div>
      )}

      {decision ? (
        <motion.p
          animate={{ opacity: 1 }}
          className="border-t border-border bg-canvas/30 px-3.5 py-2 text-xs font-semibold capitalize text-muted"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.2, ease: EASE_OUT }
          }
        >
          {decision}
        </motion.p>
      ) : null}
    </motion.div>
  )
}

export default AIDiff

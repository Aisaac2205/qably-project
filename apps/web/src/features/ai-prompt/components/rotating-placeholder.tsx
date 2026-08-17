import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { placeholderPresence, PLACEHOLDER_CYCLE_DEFAULT } from '../constants'

export function RotatingPlaceholder({
  phrases,
  interval,
  active,
  reduceMotion,
}: {
  phrases: readonly string[]
  interval: number
  active: boolean
  reduceMotion: boolean
}) {
  const [index, setIndex] = React.useState(0)
  const safePhrases = phrases.length > 0 ? phrases : PLACEHOLDER_CYCLE_DEFAULT
  const phraseCount = safePhrases.length

  React.useEffect(() => {
    if (!active || reduceMotion || phraseCount <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % phraseCount)
    }, interval)
    return () => window.clearInterval(id)
  }, [active, interval, reduceMotion, phraseCount])

  const current = safePhrases[index % phraseCount] ?? safePhrases[0]
  if (!active) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 px-1">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={current}
          className="text-muted block truncate text-[14px] leading-6 sm:text-[15px]"
          {...placeholderPresence(reduceMotion)}
        >
          {current}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

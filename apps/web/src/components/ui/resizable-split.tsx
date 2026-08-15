'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'

interface ResizableSplitProps {
  storageKey: string
  defaultWidth?: number
  minWidth?: number
  /** Max width as a fraction of the container width (0–1). */
  maxRatio?: number
  /** Which side carries the fixed-width pane. */
  side?: 'left' | 'right'
  className?: string
  first: React.ReactNode
  second: React.ReactNode
}

const STORAGE_PREFIX = 'qably:split:'
const KEYBOARD_STEP = 8
const KEYBOARD_STEP_SHIFT = 32

export function ResizableSplit({
  storageKey,
  defaultWidth,
  minWidth,
  maxRatio,
  side,
  className,
  first,
  second,
}: ResizableSplitProps) {
  const hydrated = useHydrated()

  return (
    <ResizableSplitContent
      key={`${hydrated}:${storageKey}`}
      storageKey={storageKey}
      defaultWidth={defaultWidth}
      minWidth={minWidth}
      maxRatio={maxRatio}
      side={side}
      className={className}
      first={first}
      second={second}
      hydrated={hydrated}
    />
  )
}

function ResizableSplitContent({
  storageKey,
  defaultWidth = 288,
  minWidth = 240,
  maxRatio = 0.5,
  side = 'left',
  className,
  first,
  second,
  hydrated,
}: ResizableSplitProps & { hydrated: boolean }) {
  const fullKey = `${STORAGE_PREFIX}${storageKey}`
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(() => {
    if (!hydrated) return defaultWidth

    try {
      const saved = localStorage.getItem(fullKey)
      const parsed = saved ? parseInt(saved, 10) : defaultWidth
      if (Number.isFinite(parsed) && parsed >= minWidth) {
        return parsed
      }
    } catch {
      /* localStorage unavailable */
    }
    return defaultWidth
  })
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragOrigin = useRef<{ x: number; w: number } | null>(null)

  // Measure container so the max constraint reacts to viewport changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const maxWidth =
    containerWidth > 0 ? Math.max(minWidth, Math.floor(containerWidth * maxRatio)) : Infinity
  const clamp = useCallback(
    (n: number) => Math.max(minWidth, Number.isFinite(maxWidth) ? Math.min(maxWidth, n) : n),
    [maxWidth, minWidth],
  )
  const displayedWidth = clamp(width)

  // Lock body cursor + selection while dragging so the user can sweep
  // past the handle without losing the col-resize feedback.
  useEffect(() => {
    if (!isDragging) return
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
    }
  }, [isDragging])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragOrigin.current = { x: e.clientX, w: displayedWidth }
      setIsDragging(true)
    },
    [displayedWidth],
  )

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: PointerEvent) => {
      const origin = dragOrigin.current
      if (!origin) return
      const delta = e.clientX - origin.x
      const sign = side === 'left' ? 1 : -1
      const next = Math.min(maxWidth, Math.max(minWidth, origin.w + sign * delta))
      setWidth(next)
    }
    const onUp = () => setIsDragging(false)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [isDragging, maxWidth, minWidth, side])

  // Persist width whenever it changes (and we're not mid-drag, to avoid
  // hammering localStorage on every pointermove tick).
  useEffect(() => {
    if (!hydrated || isDragging) return
    try {
      localStorage.setItem(fullKey, String(width))
    } catch {
      /* localStorage unavailable */
    }
  }, [width, hydrated, isDragging, fullKey])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? KEYBOARD_STEP_SHIFT : KEYBOARD_STEP
      const sign = side === 'left' ? 1 : -1
      let next = displayedWidth
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const dir = e.key === 'ArrowLeft' ? -1 : 1
        next = displayedWidth + sign * dir * step
      } else if (e.key === 'Home') {
        e.preventDefault()
        next = minWidth
      } else if (e.key === 'End') {
        e.preventDefault()
        next = maxWidth
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        next = defaultWidth
      } else {
        return
      }
      setWidth(clamp(next))
    },
    [displayedWidth, side, minWidth, maxWidth, defaultWidth, clamp],
  )

  const onDoubleClick = useCallback(() => {
    setWidth(clamp(defaultWidth))
  }, [defaultWidth, clamp])

  return (
    <div
      ref={containerRef}
      className={cn('flex w-full flex-none flex-col md:min-h-0 md:flex-1 md:flex-row', isDragging && 'select-none', className)}
      data-dragging={isDragging || undefined}
    >
      <div
        className="resizable-split-pane flex flex-none flex-col md:min-h-0 md:shrink-0"
        style={{ '--split-width': `${displayedWidth}px` } as React.CSSProperties}
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={displayedWidth}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
        aria-label="Resize sidebar"
        className={cn(
          'group relative hidden w-px shrink-0 self-stretch bg-border md:block',
          // Invisible 12px hit zone centered on the 1px line.
          'before:absolute before:inset-y-0 before:-left-1.5 before:w-3 before:cursor-col-resize',
          'hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none',
          isDragging && 'bg-primary/60',
        )}
      />
      <div className="flex min-w-0 flex-none flex-col md:min-h-0 md:flex-1">{second}</div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  defaultWidth = 288,
  minWidth = 240,
  maxRatio = 0.5,
  side = 'left',
  className,
  first,
  second,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>(defaultWidth)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragOrigin = useRef<{ x: number; w: number } | null>(null)

  const fullKey = `${STORAGE_PREFIX}${storageKey}`

  // Restore saved width on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(fullKey)
      if (!saved) return
      const parsed = parseInt(saved, 10)
      if (Number.isFinite(parsed) && parsed >= minWidth) {
        setWidth(parsed)
      }
    } catch {
      /* localStorage unavailable */
    }
  }, [fullKey, minWidth])

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

  // If the viewport shrinks past the saved/default width, pull the pane
  // back inside the new constraint instead of overflowing the container.
  useEffect(() => {
    if (containerWidth === 0) return
    setWidth((w) => Math.min(maxWidth, Math.max(minWidth, w)))
  }, [containerWidth, maxWidth, minWidth])

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
      dragOrigin.current = { x: e.clientX, w: width }
      setIsDragging(true)
    },
    [width],
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
    if (isDragging) return
    try {
      localStorage.setItem(fullKey, String(width))
    } catch {
      /* localStorage unavailable */
    }
  }, [width, isDragging, fullKey])

  const clamp = useCallback(
    (n: number) =>
      Math.max(
        minWidth,
        Number.isFinite(maxWidth) ? Math.min(maxWidth, n) : n,
      ),
    [maxWidth, minWidth],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? KEYBOARD_STEP_SHIFT : KEYBOARD_STEP
      const sign = side === 'left' ? 1 : -1
      let next = width
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const dir = e.key === 'ArrowLeft' ? -1 : 1
        next = width + sign * dir * step
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
    [width, side, minWidth, maxWidth, defaultWidth, clamp],
  )

  const onDoubleClick = useCallback(() => {
    setWidth(clamp(defaultWidth))
  }, [defaultWidth, clamp])

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-1 min-h-0', isDragging && 'select-none', className)}
      data-dragging={isDragging || undefined}
    >
      <div
        className="flex flex-col min-h-0 shrink-0"
        style={{ width: `${width}px` }}
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
        aria-label="Resize sidebar"
        className={cn(
          'group relative shrink-0 self-stretch w-px bg-border',
          // Invisible 12px hit zone centered on the 1px line.
          'before:absolute before:inset-y-0 before:-left-1.5 before:w-3 before:cursor-col-resize',
          'hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none',
          isDragging && 'bg-primary/60',
        )}
      />
      <div className="flex flex-1 min-w-0 min-h-0 flex-col">{second}</div>
    </div>
  )
}

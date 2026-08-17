import * as React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMounted } from './use-mounted'
import { MENU_PANEL_CLASS, menuPresence } from '../constants'

export type MenuCoords = { top: number; left: number }

export function useAnchoredMenu(disabled = false) {
  const [openRaw, setOpenRaw] = React.useState(false)
  const open = openRaw && !disabled
  const setOpen = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      if (disabled) {
        setOpenRaw(false)
        return
      }
      setOpenRaw(next)
    },
    [disabled]
  )
  const mounted = useMounted()
  const [coords, setCoords] = React.useState<MenuCoords | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const menuId = React.useId()

  React.useLayoutEffect(() => {
    if (!open) return

    const update = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      setCoords({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX,
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return

    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      const inTrigger = triggerRef.current?.contains(target)
      const inContent = contentRef.current?.contains(target)
      if (!inTrigger && !inContent) setOpen(false)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  return { open, setOpen, mounted, coords, triggerRef, contentRef, menuId }
}

export function AnchoredMenuPortal({
  mounted,
  open,
  coords,
  contentRef,
  id,
  role,
  'aria-label': ariaLabel,
  reduceMotion,
  children,
  widthClass = 'w-56',
}: {
  mounted: boolean
  open: boolean
  coords: MenuCoords | null
  contentRef: React.RefObject<HTMLDivElement | null>
  id: string
  role?: string
  'aria-label'?: string
  reduceMotion: boolean
  children: React.ReactNode
  widthClass?: string
}) {
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && coords && (
        <motion.div
          ref={contentRef}
          id={id}
          role={role}
          aria-label={ariaLabel}
          tabIndex={-1}
          {...menuPresence(reduceMotion)}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            transform: 'translateY(-100%)',
          }}
          className={`${MENU_PANEL_CLASS} ${widthClass} z-50`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

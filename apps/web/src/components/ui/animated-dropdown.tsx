'use client'

import React, { useState, useRef, FC, ReactNode } from 'react'

/**
 * @author: @emerald-ui
 * @description: Animated Dropdown Component with smooth transitions and click-outside behavior
 * @version: 1.0.0
 * @date: 2026-02-03
 * @license: MIT
 * @website: https://emerald-ui.com
 */
import { CaretDown } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref, handler])
}

export interface DropdownItem {
  name: string
  link?: string
  value?: string | number
  onClick?: () => void
  active?: boolean
}

export interface AnimatedDropdownProps {
  items?: DropdownItem[]
  text?: string
  className?: string
  align?: 'left' | 'center' | 'right'
  onSelect?: (item: DropdownItem) => void
  'aria-label'?: string
}

const DEMO: DropdownItem[] = [
  { name: 'Documentation', link: '#' },
  { name: 'Components', link: '#' },
  { name: 'Examples', link: '#' },
  { name: 'GitHub', link: '#' },
]

export default function AnimatedDropdown({
  items = DEMO,
  text = 'Select Option',
  className,
  align = 'center',
  onSelect,
  'aria-label': ariaLabel,
}: AnimatedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const alignmentClass =
    align === 'right'
      ? 'right-0 origin-top-right'
      : align === 'left'
      ? 'left-0 origin-top-left'
      : 'left-1/2 -translate-x-1/2 origin-top'

  return (
    <OnClickOutside onClickOutside={() => setIsOpen(false)}>
      <div
        data-state={isOpen ? 'open' : 'closed'}
        className={cn('group relative inline-block', className)}
      >
        <Button
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{text}</span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex items-center justify-center shrink-0"
          >
            <CaretDown className="text-muted" size={16} weight="bold" aria-hidden="true" />
          </motion.div>
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="listbox"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{
                duration: 0.18,
                ease: [0.23, 1, 0.32, 1],
              }}
              className={cn(
                'absolute top-[calc(100%+0.375rem)] z-50 w-fit min-w-full',
                alignmentClass,
                'max-h-72 overflow-y-auto overflow-x-hidden overscroll-contain rounded-lg',
                'bg-surface text-default',
                'border border-border',
                'shadow-pop',
                'p-1',
              )}
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.03,
                    },
                  },
                }}
                className="flex flex-col gap-0.5"
              >
                {items.map((item, index) => {
                  const itemContent = (
                    <>
                      <span>{item.name}</span>
                      {item.active && (
                        <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      )}
                    </>
                  )

                  const itemClass = cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer',
                    'transition-colors duration-150',
                    item.active
                      ? 'bg-surface-hover text-default font-semibold'
                      : 'text-muted hover:text-default hover:bg-surface-hover',
                    'no-underline select-none',
                  )

                  const handleSelect = (e: React.MouseEvent) => {
                    if (item.onClick) {
                      e.preventDefault()
                      item.onClick()
                    }
                    if (onSelect) {
                      onSelect(item)
                    }
                    setIsOpen(false)
                  }

                  if (item.link && !item.onClick) {
                    return (
                      <motion.a
                        key={index}
                        href={item.link}
                        onClick={() => setIsOpen(false)}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0 },
                        }}
                        className={itemClass}
                      >
                        {itemContent}
                      </motion.a>
                    )
                  }

                  return (
                    <motion.button
                      key={index}
                      type="button"
                      role="option"
                      aria-selected={item.active}
                      onClick={handleSelect}
                      variants={{
                        hidden: { opacity: 0, x: -10 },
                        visible: { opacity: 1, x: 0 },
                      }}
                      className={cn(itemClass, 'text-left')}
                    >
                      {itemContent}
                    </motion.button>
                  )
                })}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OnClickOutside>
  )
}

export { AnimatedDropdown }

interface Props {
  children: ReactNode
  onClickOutside: () => void
  classes?: string
}

const OnClickOutside: FC<Props> = ({ children, onClickOutside, classes }) => {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useClickOutside(wrapperRef, onClickOutside)

  return (
    <div ref={wrapperRef} className={cn(classes)}>
      {children}
    </div>
  )
}

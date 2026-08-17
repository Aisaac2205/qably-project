import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpIcon,
  AudioLinesIcon,
  CheckIcon,
  GlobeIcon,
  Loader2Icon,
  PlusIcon,
  PuzzleIcon,
  SquareIcon,
  TelescopeIcon,
  UnplugIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CHIP_SURFACE_CLASS,
  TOOLBAR_BTN_CLASS,
  EASE,
  SPRING_PRESS,
  SPRING_SOFT,
  iconPresence,
  scaleBlurPresence,
} from '../constants'
import { useAnchoredMenu, AnchoredMenuPortal } from '../hooks/use-anchored-menu'
import { MenuCheckmark } from './model-selector-item'

export function IconSwapFrame({
  swapKey,
  reduceMotion,
  children,
}: {
  swapKey: string
  reduceMotion: boolean
  children: React.ReactNode
}) {
  return (
    <motion.span
      key={swapKey}
      {...iconPresence(reduceMotion)}
      className="relative z-10 flex"
    >
      {children}
    </motion.span>
  )
}

export function ActiveToolChip({
  label,
  icon,
  onRemove,
  reduceMotion,
}: {
  label: string
  icon: React.ReactNode
  onRemove: () => void
  reduceMotion: boolean
}) {
  return (
    <motion.span layout {...scaleBlurPresence(reduceMotion)} className={CHIP_SURFACE_CLASS}>
      <span className="flex shrink-0 [&_svg]:size-3.5">{icon}</span>
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Disable ${label}`}
        onClick={onRemove}
        className="text-muted hover:text-default flex size-4 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary"
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </motion.span>
  )
}

export function PlusActionsMenu({
  disabled,
  reduceMotion,
  deepResearch,
  webSearch,
  onUploadFile,
  onToggleDeepResearch,
  onToggleWebSearch,
  onSkills,
  onConnectors,
}: {
  disabled?: boolean
  reduceMotion: boolean
  deepResearch: boolean
  webSearch: boolean
  onUploadFile?: () => void
  onToggleDeepResearch: () => void
  onToggleWebSearch: () => void
  onSkills?: () => void
  onConnectors?: () => void
}) {
  const { open, setOpen, mounted, coords, triggerRef, contentRef, menuId } =
    useAnchoredMenu(disabled)

  const runAndClose = (action?: () => void) => {
    action?.()
    setOpen(false)
  }

  const itemClass = (active = false) =>
    cn(
      'relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold',
      'transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
      'focus-visible:outline-2 focus-visible:outline-primary',
      active ? 'bg-surface-hover text-default' : 'text-muted hover:bg-surface-hover/70 hover:text-default'
    )

  return (
    <div className="relative">
      <motion.button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Open actions"
        onClick={() => setOpen((v) => !v)}
        whileHover={disabled ? undefined : { scale: 1.05, y: -1 }}
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className={cn(TOOLBAR_BTN_CLASS, open && 'bg-surface-hover text-default')}
      >
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="flex [&_svg]:size-4"
        >
          <PlusIcon aria-hidden />
        </motion.span>
      </motion.button>

      <AnchoredMenuPortal
        mounted={mounted}
        open={open}
        coords={coords}
        contentRef={contentRef}
        id={menuId}
        role="menu"
        aria-label="Actions"
        reduceMotion={reduceMotion}
        widthClass="w-56"
      >
        <div className="flex flex-col gap-0.5">
          <motion.button
            type="button"
            role="menuitem"
            whileTap={{ scale: 0.98 }}
            transition={SPRING_PRESS}
            className={itemClass()}
            onClick={() => runAndClose(onUploadFile)}
          >
            <UploadIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="font-semibold">Upload file</span>
          </motion.button>

          <motion.button
            type="button"
            role="menuitemcheckbox"
            aria-checked={deepResearch}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_PRESS}
            className={itemClass(deepResearch)}
            onClick={() => runAndClose(onToggleDeepResearch)}
          >
            <TelescopeIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="min-w-0 flex-1 font-semibold">Deep research</span>
            <MenuCheckmark visible={deepResearch} reduceMotion={reduceMotion} />
          </motion.button>

          <motion.button
            type="button"
            role="menuitemcheckbox"
            aria-checked={webSearch}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_PRESS}
            className={itemClass(webSearch)}
            onClick={() => runAndClose(onToggleWebSearch)}
          >
            <GlobeIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="min-w-0 flex-1 font-semibold">Web search</span>
            <MenuCheckmark visible={webSearch} reduceMotion={reduceMotion} />
          </motion.button>

          <div role="separator" className="bg-border my-1.5 h-px" />

          <motion.button
            type="button"
            role="menuitem"
            whileTap={{ scale: 0.98 }}
            transition={SPRING_PRESS}
            className={itemClass()}
            onClick={() => runAndClose(onSkills)}
          >
            <PuzzleIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="font-semibold">Skills</span>
          </motion.button>

          <motion.button
            type="button"
            role="menuitem"
            whileTap={{ scale: 0.98 }}
            transition={SPRING_PRESS}
            className={itemClass()}
            onClick={() => runAndClose(onConnectors)}
          >
            <UnplugIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="font-semibold">Connectors</span>
          </motion.button>
        </div>
      </AnchoredMenuPortal>
    </div>
  )
}

export function ActionButton({
  disabled,
  status,
  hasText,
  talking,
  onSend,
  onTalkToggle,
  reduceMotion,
}: {
  disabled?: boolean
  status: 'idle' | 'submitted' | 'streaming' | 'error'
  hasText: boolean
  talking: boolean
  onSend: () => void
  onTalkToggle: () => void
  reduceMotion: boolean
}) {
  const isLoading = status === 'submitted' || status === 'streaming'
  const isSuccess = false
  const showSend = !talking && (hasText || isLoading || isSuccess)
  const isDisabled = talking ? false : disabled || isLoading

  const label = talking
    ? 'Stop conversation'
    : isLoading
      ? 'Sending'
      : showSend
        ? 'Send prompt'
        : 'Talk with AI'

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={talking || undefined}
      aria-busy={isLoading || undefined}
      disabled={isDisabled}
      onClick={() => {
        if (talking || !showSend) onTalkToggle()
        else onSend()
      }}
      whileHover={isDisabled ? undefined : { scale: 1.06, transition: SPRING_SOFT }}
      whileTap={isDisabled ? undefined : { scale: 0.94 }}
      transition={SPRING_PRESS}
      className={cn(
        'relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full shadow-sm',
        'transition-[background-color,box-shadow,opacity,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
        'focus-visible:outline-2 focus-visible:outline-primary',
        'disabled:pointer-events-none',
        showSend || talking
          ? 'bg-primary text-primary-fg hover:bg-primary-hover shadow-card'
          : 'bg-surface-hover text-muted hover:text-default'
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {talking ? (
          <IconSwapFrame swapKey="stop" reduceMotion={reduceMotion}>
            <SquareIcon className="size-3.5 fill-current" aria-hidden />
          </IconSwapFrame>
        ) : isLoading ? (
          <IconSwapFrame swapKey="loader" reduceMotion={reduceMotion}>
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          </IconSwapFrame>
        ) : showSend ? (
          <IconSwapFrame swapKey="arrow" reduceMotion={reduceMotion}>
            <ArrowUpIcon className="size-4" aria-hidden />
          </IconSwapFrame>
        ) : (
          <IconSwapFrame swapKey="waves" reduceMotion={reduceMotion}>
            <AudioLinesIcon className="size-4" aria-hidden />
          </IconSwapFrame>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

import * as React from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { CheckIcon, PencilIcon } from 'lucide-react'
import { GeminiIcon } from '@/components/icons/gemini-icon'
import { cn } from '@/lib/utils'
import type { AiModel, AiModelSelection } from '../types'
import {
  EFFORT_LABEL,
  MENU_PANEL_CLASS,
  SPRING_PRESS,
  SPRING_SOFT,
  iconPresence,
} from '../constants'
import {
  useModelSelectorContext,
  optionDomId,
} from './model-selector-context'

export const itemVariants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
}

export const itemVariantsReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
}

export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

export function ModelLabelParts({
  model,
  selection,
  className,
}: {
  model: AiModel | undefined
  selection: AiModelSelection
  className?: string
}) {
  if (!model) {
    return <span className={cn('text-muted', className)}>Select model</span>
  }

  const mods: string[] = []
  if (selection.effort) mods.push(EFFORT_LABEL[selection.effort])
  if (selection.fast) mods.push('Fast')
  if (selection.thinking) mods.push('Thinking')

  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      {model.isGemini && <GeminiIcon className="size-3.5 shrink-0" />}
      <span className="truncate font-semibold text-default">{model.label}</span>
      {mods.map((mod) => (
        <span key={mod} className="text-muted text-xs shrink-0 font-medium tabular-nums">
          {mod}
        </span>
      ))}
    </span>
  )
}

export function MenuCheckmark({
  visible,
  reduceMotion,
  className,
}: {
  visible: boolean
  reduceMotion: boolean
  className?: string
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span {...iconPresence(reduceMotion)} className={cn('flex items-center justify-center', className)}>
          <CheckIcon className="size-3.5" aria-hidden />
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export function OptionChip({
  selected,
  onClick,
  children,
  disabled,
  reduceMotion,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium',
        'transition-[background-color,color,box-shadow,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
        'focus-visible:outline-2 focus-visible:outline-primary',
        selected
          ? 'bg-surface-hover text-default shadow-xs font-semibold'
          : 'text-muted hover:bg-surface-hover/70 hover:text-default',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      <span>{children}</span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <MenuCheckmark visible={selected} reduceMotion={reduceMotion} className="text-default" />
      </span>
    </motion.button>
  )
}

export function ToggleChip({
  selected,
  onClick,
  children,
  reduceMotion,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium',
        'transition-[background-color,color,box-shadow,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
        'focus-visible:outline-2 focus-visible:outline-primary',
        selected
          ? 'bg-surface-hover text-default shadow-xs font-semibold'
          : 'text-muted hover:bg-surface-hover/70 hover:text-default'
      )}
    >
      <span>{children}</span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <MenuCheckmark visible={selected} reduceMotion={reduceMotion} className="text-default" />
      </span>
    </motion.button>
  )
}

export function ModelSelectorItem({ model }: { model: AiModel }) {
  const {
    selection,
    selectModel,
    reduceMotion,
    layoutGroupId,
    contentId,
    activeIndex,
    setActiveIndex,
    optionIds,
    editingId,
    setEditingId,
    setPreviewId,
    getConfigFor,
    patchSelection,
  } = useModelSelectorContext('ModelSelectorItem')

  const isActive = model.id === selection.id
  const isEditing = editingId === model.id
  const optionIndex = optionIds.indexOf(model.id)
  const isHighlighted = optionIndex === activeIndex && optionIndex >= 0
  const isDisabled = !!model.disabled
  const config = getConfigFor(model)
  const optionId = optionDomId(contentId, model.id)
  const optionRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (isHighlighted) {
      optionRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [isHighlighted])

  return (
    <motion.div
      variants={reduceMotion ? itemVariantsReduced : itemVariants}
      className={cn(
        'group/item relative flex w-full items-center gap-1 rounded-xl',
        'transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
        isActive ? 'text-default font-medium' : 'text-muted',
        isHighlighted && !isActive && 'bg-surface-hover/60',
        isEditing && 'bg-surface-hover',
        isDisabled && 'pointer-events-none opacity-40'
      )}
      onMouseEnter={() => {
        if (!isDisabled && optionIndex >= 0) {
          setActiveIndex(optionIndex)
          if (!editingId) setPreviewId(model.id)
        }
      }}
    >
      {isActive ? (
        <motion.span
          layoutId={`${layoutGroupId}-active`}
          className="bg-surface-hover absolute inset-0 rounded-xl"
          transition={SPRING_SOFT}
        />
      ) : null}

      <div
        ref={optionRef}
        id={optionId}
        role="option"
        aria-selected={isActive}
        aria-disabled={isDisabled || undefined}
        data-slot="model-selector-item"
        data-highlighted={isHighlighted ? '' : undefined}
        data-active={isActive ? '' : undefined}
        data-editing={isEditing ? '' : undefined}
        onClick={() => {
          if (!isDisabled) selectModel(model.id)
        }}
        className={cn(
          'relative z-10 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left',
          'transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
          !isDisabled && 'active:scale-[0.98]'
        )}
      >
        <span className="min-w-0 flex-1">
          <ModelLabelParts model={model} selection={config} className="text-xs sm:text-sm" />
        </span>
        {isActive ? (
          <MenuCheckmark visible reduceMotion={reduceMotion} className="text-default" />
        ) : (
          <span className="size-3.5 shrink-0" aria-hidden />
        )}
      </div>

      <motion.button
        type="button"
        data-slot="model-selector-edit"
        aria-label={`Edit ${model.label} settings`}
        aria-expanded={isEditing}
        disabled={isDisabled}
        onClick={(event) => {
          event.stopPropagation()
          if (isEditing) {
            setEditingId(null)
            return
          }
          patchSelection({ ...config, id: model.id })
          setEditingId(model.id)
        }}
        whileTap={isDisabled ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className={cn(
          'relative z-10 mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg',
          'text-muted opacity-0 transition-[opacity,background-color,color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
          'hover:bg-surface-hover hover:text-default',
          'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary',
          'group-hover/item:opacity-100',
          (isEditing || isHighlighted) && 'opacity-100',
          isEditing && 'bg-surface-hover text-default'
        )}
      >
        <PencilIcon className="size-3.5" aria-hidden />
      </motion.button>
    </motion.div>
  )
}

export function ModelSelectorDefaultItems() {
  const { models, layoutGroupId, reduceMotion, editingId, setPreviewId } =
    useModelSelectorContext('ModelSelectorDefaultItems')

  return (
    <LayoutGroup id={layoutGroupId}>
      <motion.ul
        role="presentation"
        variants={listVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        className={cn(MENU_PANEL_CLASS, 'flex min-w-64 flex-col gap-0.5')}
        onMouseLeave={() => {
          if (!editingId) setPreviewId(null)
        }}
      >
        {models.map((model) => (
          <li key={model.id} role="none">
            <ModelSelectorItem model={model} />
          </li>
        ))}
      </motion.ul>
    </LayoutGroup>
  )
}

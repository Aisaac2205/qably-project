import * as React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  AiModel,
  AiModelSelection,
  ModelSelectorProps,
  ModelSelectorTriggerProps,
  ModelSelectorValueProps,
  ModelSelectorContentProps,
  ModelSelectorKitProps,
} from '../types'
import {
  DEFAULT_AI_MODELS,
  EFFORT_LABEL,
  EASE,
  SPRING_PRESS,
  menuPresence,
  valuePresence,
} from '../constants'
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion'
import { useControllableState } from '../hooks/use-controllable-state'
import { useMounted } from '../hooks/use-mounted'
import {
  ModelSelectorContext,
  useModelSelectorContext,
  defaultSelectionFor,
  resolveSelection,
  firstEnabledIndex,
  lastEnabledIndex,
  optionDomId,
} from './model-selector-context'
import {
  ModelLabelParts,
  ModelSelectorDefaultItems,
} from './model-selector-item'
import { ModelSidePanel } from './model-selector-edit'

function assignRef<T>(node: T | null, ...refs: Array<React.Ref<T> | undefined>) {
  for (const ref of refs) {
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<T | null>).current = node
  }
}

export function ModelSelector({
  children,
  models = DEFAULT_AI_MODELS,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  'aria-label': ariaLabel = 'AI models',
}: ModelSelectorProps) {
  const reduceMotion = usePrefersReducedMotion()
  const layoutGroupId = React.useId()
  const contentId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  const initial =
    defaultValue ?? (models[0] ? defaultSelectionFor(models[0]) : { id: '' })

  const [selection, setSelection] = useControllableState({
    value: valueProp,
    defaultValue: initial,
    onChange: onValueChange,
  })

  const [open, setOpenState] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })

  const [activeIndex, setActiveIndex] = React.useState(0)
  const [side, setSide] = React.useState<'top' | 'bottom'>('top')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [previewId, setPreviewId] = React.useState<string | null>(null)

  const optionIds = React.useMemo(() => models.map((m) => m.id), [models])
  const configCacheRef = React.useRef<Record<string, AiModelSelection>>({})
  const resolved = resolveSelection(models, selection)

  React.useEffect(() => {
    if (resolved.id) configCacheRef.current[resolved.id] = resolved
  }, [resolved])

  const selectedModel = models.find((m) => m.id === resolved.id) ?? models[0]

  const getConfigFor = React.useCallback(
    (model: AiModel): AiModelSelection => {
      if (resolved.id === model.id) return resolved
      return configCacheRef.current[model.id] ?? defaultSelectionFor(model)
    },
    [resolved]
  )

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (disabled && next) return
      setOpenState(next)
      if (next) {
        const idx = optionIds.indexOf(resolved.id)
        setActiveIndex(idx >= 0 ? idx : firstEnabledIndex(models, optionIds))
      } else {
        setEditingId(null)
        setPreviewId(null)
      }
    },
    [disabled, setOpenState, optionIds, resolved.id, models]
  )

  const selectModel = React.useCallback(
    (id: string) => {
      const model = models.find((m) => m.id === id)
      if (!model || model.disabled) return
      const next = resolveSelection(models, { ...getConfigFor(model), id })
      setSelection(next)
      setEditingId(null)
      setOpen(false)
      triggerRef.current?.focus()
    },
    [models, getConfigFor, setSelection, setOpen]
  )

  const patchSelection = React.useCallback(
    (patch: Partial<AiModelSelection>) => {
      setSelection((prev) => {
        const id = patch.id ?? prev.id
        const model = models.find((m) => m.id === id)
        const base = model
          ? id === prev.id
            ? resolveSelection(models, prev)
            : (configCacheRef.current[id] ?? defaultSelectionFor(model))
          : prev
        const next = resolveSelection(models, { ...base, ...patch, id })
        configCacheRef.current[id] = next
        return next
      })
    },
    [models, setSelection]
  )

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
      if (event.key === 'Escape') {
        event.preventDefault()
        if (editingId) {
          setEditingId(null)
          return
        }
        setOpen(false)
        triggerRef.current?.focus()
        return
      }

      if (editingId || optionIds.length === 0) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((prev) => {
          let next = prev
          for (let i = 0; i < optionIds.length; i++) {
            next = (next + delta + optionIds.length) % optionIds.length
            const model = models.find((m) => m.id === optionIds[next])
            if (!model?.disabled) break
          }
          return next
        })
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target as HTMLElement | null
        if (target?.closest("[data-slot='model-selector-item']")) return
        if (target?.closest("[data-slot='model-selector-edit']")) return
        event.preventDefault()
        const id = optionIds[activeIndex]
        if (id) selectModel(id)
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        setActiveIndex(firstEnabledIndex(models, optionIds))
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        setActiveIndex(lastEnabledIndex(models, optionIds))
      }
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen, optionIds, activeIndex, models, selectModel, editingId])

  return (
    <ModelSelectorContext.Provider
      value={{
        open,
        setOpen,
        selection: resolved,
        selectModel,
        patchSelection,
        models,
        selectedModel,
        disabled,
        reduceMotion,
        triggerRef,
        contentRef,
        contentId,
        layoutGroupId,
        activeIndex,
        setActiveIndex,
        optionIds,
        ariaLabel,
        side,
        setSide,
        editingId,
        setEditingId,
        previewId,
        setPreviewId,
        getConfigFor,
      }}
    >
      <div
        data-slot="model-selector"
        data-state={open ? 'open' : 'closed'}
        className={cn('relative inline-flex', className)}
      >
        {children}
      </div>
    </ModelSelectorContext.Provider>
  )
}
ModelSelector.displayName = 'ModelSelector'

export const ModelSelectorTrigger = React.forwardRef<
  HTMLButtonElement,
  ModelSelectorTriggerProps
>(({ className, children, disabled, onClick, ...props }, ref) => {
  const {
    open,
    setOpen,
    triggerRef,
    contentId,
    disabled: rootDisabled,
    selectedModel,
    selection,
  } = useModelSelectorContext('ModelSelectorTrigger')

  const isDisabled = disabled || rootDisabled
  const label = selectedModel
    ? [
        selectedModel.label,
        selection.effort ? EFFORT_LABEL[selection.effort] : null,
        selection.fast ? 'Fast' : null,
        selection.thinking ? 'Thinking' : null,
      ]
        .filter(Boolean)
        .join(' ')
    : 'Select model'

  return (
    <motion.button
      ref={(node) => assignRef(node, ref, triggerRef)}
      type="button"
      disabled={isDisabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={contentId}
      aria-label={`Model: ${label}`}
      data-slot="model-selector-trigger"
      data-state={open ? 'open' : 'closed'}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || isDisabled) return
        setOpen(!open)
      }}
      whileHover={isDisabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        'text-default flex min-h-9 cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold',
        'transition-[background-color,color,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
        'bg-surface border border-border shadow-xs hover:bg-surface-hover',
        'focus-visible:outline-2 focus-visible:outline-primary',
        'disabled:pointer-events-none disabled:opacity-40',
        open && 'bg-surface-hover',
        className
      )}
      {...props}
    >
      {children ?? <ModelSelectorValue />}
      <motion.span
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="flex shrink-0 ml-0.5"
      >
        <ChevronDownIcon className="size-3.5 text-muted" aria-hidden />
      </motion.span>
    </motion.button>
  )
})
ModelSelectorTrigger.displayName = 'ModelSelectorTrigger'

export function ModelSelectorValue({ className, ...props }: ModelSelectorValueProps) {
  const { selectedModel, selection, reduceMotion } =
    useModelSelectorContext('ModelSelectorValue')

  return (
    <span
      data-slot="model-selector-value"
      className={cn('relative flex min-w-0 items-center', className)}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${selection.id}-${selection.effort}-${selection.fast}-${selection.thinking}`}
          {...valuePresence(reduceMotion)}
          className="flex min-w-0"
        >
          <ModelLabelParts
            model={selectedModel}
            selection={selection}
            className="text-xs sm:text-sm"
          />
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
ModelSelectorValue.displayName = 'ModelSelectorValue'

export const ModelSelectorContent = React.forwardRef<
  HTMLDivElement,
  ModelSelectorContentProps
>(({ className, children, side: sideProp = 'top', style, ...props }, ref) => {
  const {
    open,
    contentId,
    triggerRef,
    contentRef,
    reduceMotion,
    ariaLabel,
    setSide,
    editingId,
    previewId,
    models,
    activeIndex,
    optionIds,
  } = useModelSelectorContext('ModelSelectorContent')

  const mounted = useMounted()
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)

  React.useEffect(() => {
    setSide(sideProp)
  }, [sideProp, setSide])

  React.useLayoutEffect(() => {
    if (!open) return

    const update = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      if (sideProp === 'bottom') {
        setCoords({ top: rect.bottom + 8, left: rect.left })
      } else {
        setCoords({ top: rect.top - 8, left: rect.left })
      }
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, triggerRef, sideProp])

  if (!mounted) return null

  const list = children ?? <ModelSelectorDefaultItems />
  const activeModelId = optionIds[activeIndex]
  const activeOptionId = activeModelId ? optionDomId(contentId, activeModelId) : undefined

  const editingModel = editingId ? models.find((m) => m.id === editingId) : null
  const previewModel = previewId ? models.find((m) => m.id === previewId) : null
  const panelModel = editingModel ?? previewModel

  return createPortal(
    <AnimatePresence>
      {open && coords ? (
        <motion.div
          key={contentId}
          ref={(node) => assignRef(node, ref, contentRef)}
          data-slot="model-selector-content"
          data-editing={editingId ? '' : undefined}
          {...menuPresence(reduceMotion)}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: sideProp === 'top' ? 'translateY(-100%)' : undefined,
            zIndex: 50,
            ...style,
          }}
          className={cn('flex origin-top-left items-start gap-3', className)}
          {...props}
        >
          <div
            id={contentId}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={activeOptionId}
            data-slot="model-selector-listbox"
            className="min-w-0"
          >
            {list}
          </div>

          <AnimatePresence initial={false}>
            {panelModel ? (
              <ModelSidePanel
                key="model-side-panel"
                model={panelModel}
                editing={!!editingModel}
              />
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
})
ModelSelectorContent.displayName = 'ModelSelectorContent'

export function ModelSelectorKit({
  models = DEFAULT_AI_MODELS,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: ModelSelectorKitProps) {
  return (
    <ModelSelector
      models={models}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    >
      <ModelSelectorTrigger />
      <ModelSelectorContent />
    </ModelSelector>
  )
}

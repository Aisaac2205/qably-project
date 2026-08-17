import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TelescopeIcon, GlobeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AiPromptInputProps } from '../types'
import {
  DEFAULT_AI_MODELS,
  PLACEHOLDER_CYCLE_DEFAULT,
  SPRING_HEIGHT,
} from '../constants'
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion'
import { useControllableState } from '../hooks/use-controllable-state'
import { defaultSelectionFor } from './model-selector-context'
import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorValue,
  ModelSelectorContent,
} from './model-selector'
import { RotatingPlaceholder } from './rotating-placeholder'
import {
  ActiveToolChip,
  PlusActionsMenu,
  ActionButton,
} from './toolbar-actions'

function assignRef<T>(node: T | null, ...refs: Array<React.Ref<T> | undefined>) {
  for (const ref of refs) {
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<T | null>).current = node
  }
}

export const AiPromptInput = React.forwardRef<HTMLTextAreaElement, AiPromptInputProps>(
  (
    {
      value: valueProp,
      defaultValue = '',
      onChange,
      onSubmit,
      placeholders = PLACEHOLDER_CYCLE_DEFAULT,
      placeholderInterval = 3200,
      models = DEFAULT_AI_MODELS,
      modelSelection: modelSelectionProp,
      defaultModelSelection,
      onModelSelectionChange,
      disabled = false,
      status = 'idle',
      maxLength = 4000,
      minRows = 1,
      maxRows = 8,
      showToolbar = true,
      showActions = true,
      showModelSelector = true,
      deepResearch: deepResearchProp,
      defaultDeepResearch = false,
      onDeepResearchChange,
      webSearch: webSearchProp,
      defaultWebSearch = false,
      onWebSearchChange,
      onUploadFile,
      onSkills,
      onConnectors,
      onVoiceChange,
      className,
      textareaClassName,
      'aria-label': ariaLabel = 'AI prompt',
      'data-testid': dataTestId,
    },
    ref
  ) => {
    const [value, setValue] = useControllableState({
      value: valueProp,
      defaultValue,
      onChange,
    })

    const initialSelection =
      defaultModelSelection ??
      (models[0] ? defaultSelectionFor(models[0]) : { id: '' })
    const [modelSelection, setModelSelection] = useControllableState({
      value: modelSelectionProp,
      defaultValue: initialSelection,
      onChange: onModelSelectionChange,
    })

    const [deepResearch, setDeepResearch] = useControllableState({
      value: deepResearchProp,
      defaultValue: defaultDeepResearch,
      onChange: onDeepResearchChange,
    })

    const [webSearch, setWebSearch] = useControllableState({
      value: webSearchProp,
      defaultValue: defaultWebSearch,
      onChange: onWebSearchChange,
    })

    const [focused, setFocused] = React.useState(false)
    const [height, setHeight] = React.useState<number | 'auto'>('auto')
    const reduceMotion = usePrefersReducedMotion()
    const [dictating] = React.useState(false)
    const [talking, setTalking] = React.useState(false)

    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const mirrorRef = React.useRef<HTMLDivElement | null>(null)
    const fieldId = React.useId()

    const trimmed = value.trim()
    const hasText = trimmed.length > 0
    const showPlaceholder = value.length === 0 && !focused
    const hasActiveTools = deepResearch || webSearch
    const sessionLocked = dictating || talking

    const resize = React.useCallback(() => {
      const el = textareaRef.current
      const mirror = mirrorRef.current
      if (!el) return

      const styles = window.getComputedStyle(el)
      const lineHeight = Number.parseFloat(styles.lineHeight) || 24
      const paddingY =
        Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
      const minH = lineHeight * minRows + paddingY
      const maxH = lineHeight * maxRows + paddingY

      if (mirror) {
        mirror.style.width = `${el.clientWidth}px`
        mirror.textContent = value.endsWith('\n') ? `${value} ` : value || ' '
        const next = Math.min(Math.max(mirror.scrollHeight, minH), maxH)
        setHeight(next)
        el.style.overflowY = mirror.scrollHeight > maxH ? 'auto' : 'hidden'
      } else {
        el.style.height = 'auto'
        const next = Math.min(Math.max(el.scrollHeight, minH), maxH)
        setHeight(next)
        el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden'
      }
    }, [value, minRows, maxRows])

    React.useLayoutEffect(() => {
      resize()
    }, [resize])

    const submit = React.useCallback(() => {
      if (disabled || status === 'submitted' || status === 'streaming' || !trimmed) return
      onSubmit?.(trimmed, modelSelection)
    }, [disabled, status, trimmed, onSubmit, modelSelection])

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault()
        submit()
      }
    }

    const toggleTalking = () => {
      const next = !talking
      setTalking(next)
      onVoiceChange?.(next)
    }

    return (
      <motion.div
        data-slot="ai-prompt-input"
        data-focused={focused || undefined}
        data-disabled={disabled || undefined}
        data-status={status}
        data-dictating={dictating || undefined}
        className={cn(
          'bg-surface border border-border relative w-full overflow-visible rounded-2xl p-3.5 sm:p-4 shadow-card',
          'transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          focused && 'border-primary/50 shadow-md',
          disabled && 'pointer-events-none opacity-55',
          className
        )}
        data-testid={dataTestId}
      >
        <div
          ref={mirrorRef}
          aria-hidden
          className="invisible absolute top-0 left-0 -z-10 px-1 text-[14px] leading-6 break-words whitespace-pre-wrap sm:text-[15px]"
        />

        <AnimatePresence initial={false}>
          {hasActiveTools ? (
            <motion.div
              key="active-tools"
              initial={false}
              className="mb-2 flex flex-wrap items-center gap-1.5 px-0.5"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {deepResearch ? (
                  <ActiveToolChip
                    key="deep-research"
                    label="Deep research"
                    icon={<TelescopeIcon aria-hidden />}
                    reduceMotion={reduceMotion}
                    onRemove={() => setDeepResearch(false)}
                  />
                ) : null}
                {webSearch ? (
                  <ActiveToolChip
                    key="web-search"
                    label="Web search"
                    icon={<GlobeIcon aria-hidden />}
                    reduceMotion={reduceMotion}
                    onRemove={() => setWebSearch(false)}
                  />
                ) : null}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative min-h-6">
          <RotatingPlaceholder
            phrases={placeholders}
            interval={placeholderInterval}
            active={showPlaceholder}
            reduceMotion={reduceMotion}
          />

          <motion.textarea
            id={fieldId}
            ref={(node) => assignRef(node, ref, textareaRef)}
            value={value}
            disabled={disabled || sessionLocked}
            rows={minRows}
            maxLength={maxLength}
            aria-label={ariaLabel}
            aria-multiline="true"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            animate={
              reduceMotion
                ? undefined
                : { height: typeof height === 'number' ? height : undefined }
            }
            transition={SPRING_HEIGHT}
            className={cn(
              'text-default relative z-10 block w-full resize-none bg-transparent px-1 font-normal',
              'text-[14px] leading-6 sm:text-[15px]',
              'placeholder:text-transparent',
              'outline-none focus-visible:outline-none',
              'disabled:cursor-not-allowed',
              textareaClassName
            )}
            style={
              reduceMotion && typeof height === 'number'
                ? { height }
                : undefined
            }
          />
        </div>

        <AnimatePresence initial={false}>
          {showToolbar ? (
            <motion.div
              key="toolbar"
              initial={false}
              className="border-border mt-3 flex items-center justify-between gap-2 border-t pt-2.5"
            >
              <div
                className={cn(
                  'flex min-w-0 items-center gap-1 sm:gap-1.5',
                  sessionLocked && 'pointer-events-none opacity-40'
                )}
              >
                {showActions ? (
                  <PlusActionsMenu
                    disabled={disabled || sessionLocked}
                    reduceMotion={reduceMotion}
                    deepResearch={deepResearch}
                    webSearch={webSearch}
                    onUploadFile={onUploadFile}
                    onToggleDeepResearch={() => setDeepResearch(!deepResearch)}
                    onToggleWebSearch={() => setWebSearch(!webSearch)}
                    onSkills={onSkills}
                    onConnectors={onConnectors}
                  />
                ) : null}

                {showModelSelector && models.length > 0 ? (
                  <ModelSelector
                    models={models}
                    value={modelSelection}
                    onValueChange={setModelSelection}
                    disabled={disabled || sessionLocked}
                  >
                    <ModelSelectorTrigger className="h-8">
                      <ModelSelectorValue className="max-w-40 sm:max-w-56" />
                    </ModelSelectorTrigger>
                    <ModelSelectorContent side="top" />
                  </ModelSelector>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <ActionButton
                  disabled={disabled}
                  status={status}
                  hasText={hasText}
                  talking={talking}
                  onSend={submit}
                  onTalkToggle={toggleTalking}
                  reduceMotion={reduceMotion}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    )
  }
)
AiPromptInput.displayName = 'AiPromptInput'

import { motion } from 'framer-motion'
import { GeminiIcon } from '@/components/icons/gemini-icon'
import { cn } from '@/lib/utils'
import type { AiModel } from '../types'
import {
  EFFORT_LABEL,
  MENU_PANEL_CLASS,
  flyoutPresence,
} from '../constants'
import {
  useModelSelectorContext,
  formatContext,
} from './model-selector-context'
import { OptionChip, ToggleChip } from './model-selector-item'

export function ModelSidePanel({ model, editing }: { model: AiModel; editing: boolean }) {
  const { reduceMotion } = useModelSelectorContext('ModelSidePanel')

  return (
    <motion.aside
      data-slot="model-selector-side-panel"
      aria-label={editing ? `${model.label} settings` : `${model.label} details`}
      {...flyoutPresence(reduceMotion)}
      className={cn(MENU_PANEL_CLASS, 'flex w-56 shrink-0 flex-col gap-3 p-3')}
    >
      {editing ? (
        <ModelEditPanelContent model={model} />
      ) : (
        <ModelInfoPanelContent model={model} />
      )}
    </motion.aside>
  )
}

export function ModelInfoPanelContent({ model }: { model: AiModel }) {
  const contexts = model.contexts
    ?.map((context) => formatContext(context))
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <div className="flex items-center gap-2 font-semibold text-sm text-default">
        {model.isGemini && <GeminiIcon className="size-4 shrink-0" />}
        <span>{model.label}</span>
      </div>
      {model.description ? (
        <p className="text-muted text-xs leading-relaxed">
          {model.description}
        </p>
      ) : null}
      {contexts ? (
        <div className="mt-1 flex flex-col gap-1">
          <span className="text-muted text-[10px] font-semibold tracking-wide uppercase">
            Context window
          </span>
          <span className="text-default text-xs font-mono font-medium tabular-nums">
            {contexts}
          </span>
        </div>
      ) : null}
    </>
  )
}

export function ModelEditPanelContent({ model }: { model: AiModel }) {
  const { getConfigFor, patchSelection, reduceMotion } =
    useModelSelectorContext('ModelEditPanelContent')

  const config = getConfigFor(model)
  const efforts = model.efforts ?? []
  const contexts = model.contexts ?? []

  return (
    <>
      {efforts.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-muted px-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Effort
          </div>
          <div className="flex flex-col gap-0.5">
            {efforts.map((effort) => (
              <OptionChip
                key={effort}
                selected={config.effort === effort}
                reduceMotion={reduceMotion}
                onClick={() => patchSelection({ id: model.id, effort })}
              >
                {EFFORT_LABEL[effort]}
              </OptionChip>
            ))}
          </div>
        </div>
      ) : null}

      {contexts.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-muted px-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Context
          </div>
          <div className="flex flex-col gap-0.5">
            {contexts.map((ctx) => {
              const label = formatContext(ctx) ?? String(ctx)
              return (
                <OptionChip
                  key={label}
                  selected={config.context === label}
                  reduceMotion={reduceMotion}
                  onClick={() => patchSelection({ id: model.id, context: label })}
                >
                  <span className="tabular-nums font-mono">{label}</span>
                </OptionChip>
              )
            })}
          </div>
        </div>
      ) : null}

      {(model.supportsFast || model.supportsThinking) && (
        <div className="flex flex-col gap-1.5">
          <div className="text-muted px-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Modes
          </div>
          <div className="flex flex-col gap-0.5">
            {model.supportsFast ? (
              <ToggleChip
                selected={!!config.fast}
                reduceMotion={reduceMotion}
                onClick={() => patchSelection({ id: model.id, fast: !config.fast })}
              >
                Fast
              </ToggleChip>
            ) : null}
            {model.supportsThinking ? (
              <ToggleChip
                selected={!!config.thinking}
                reduceMotion={reduceMotion}
                onClick={() => patchSelection({ id: model.id, thinking: !config.thinking })}
              >
                Thinking
              </ToggleChip>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

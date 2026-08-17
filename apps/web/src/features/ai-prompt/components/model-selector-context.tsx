import * as React from 'react'
import type { AiModel, AiModelSelection } from '../types'

export interface ModelSelectorContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  selection: AiModelSelection
  selectModel: (id: string) => void
  patchSelection: (patch: Partial<AiModelSelection>) => void
  models: AiModel[]
  selectedModel: AiModel | undefined
  disabled: boolean
  reduceMotion: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  contentId: string
  layoutGroupId: string
  activeIndex: number
  setActiveIndex: (index: number) => void
  optionIds: string[]
  ariaLabel: string
  side: 'top' | 'bottom'
  setSide: (side: 'top' | 'bottom') => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  previewId: string | null
  setPreviewId: (id: string | null) => void
  getConfigFor: (model: AiModel) => AiModelSelection
}

export const ModelSelectorContext = React.createContext<ModelSelectorContextValue | null>(null)

export function useModelSelectorContext(component: string): ModelSelectorContextValue {
  const ctx = React.useContext(ModelSelectorContext)
  if (!ctx) {
    throw new Error(`${component} must be used within <ModelSelector>`)
  }
  return ctx
}

export function optionDomId(contentId: string, modelId: string): string {
  return `${contentId}-option-${modelId}`
}

export function firstEnabledIndex(models: AiModel[], optionIds: string[]): number {
  for (let i = 0; i < optionIds.length; i++) {
    const model = models.find((m) => m.id === optionIds[i])
    if (model && !model.disabled) return i
  }
  return 0
}

export function lastEnabledIndex(models: AiModel[], optionIds: string[]): number {
  for (let i = optionIds.length - 1; i >= 0; i--) {
    const model = models.find((m) => m.id === optionIds[i])
    if (model && !model.disabled) return i
  }
  return Math.max(0, optionIds.length - 1)
}

export function formatContext(context: string | number | undefined): string | null {
  if (context === undefined || context === '') return null
  if (typeof context === 'number') {
    if (context >= 1_000_000) return `${(context / 1_000_000).toFixed(0)}M`
    if (context >= 1_000) return `${Math.round(context / 1_000)}K`
    return String(context)
  }
  return String(context)
}

export function defaultSelectionFor(model: AiModel): AiModelSelection {
  return {
    id: model.id,
    effort: model.defaultEffort ?? model.efforts?.[0],
    context: formatContext(model.defaultContext ?? model.contexts?.[0]) ?? undefined,
    fast: model.defaultFast ?? false,
    thinking: model.defaultThinking ?? false,
  }
}

export function resolveSelection(models: AiModel[], value?: AiModelSelection): AiModelSelection {
  const model = models.find((m) => m.id === value?.id) ?? models[0]
  if (!model) {
    return { id: value?.id ?? '' }
  }
  const base = defaultSelectionFor(model)
  if (!value || value.id !== model.id) return base
  return {
    id: model.id,
    effort: value.effort ?? base.effort,
    context: value.context ?? base.context,
    fast: value.fast ?? base.fast,
    thinking: value.thinking ?? base.thinking,
  }
}

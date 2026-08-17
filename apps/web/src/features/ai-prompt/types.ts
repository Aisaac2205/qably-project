import type * as React from 'react'
import type { HTMLMotionProps } from 'framer-motion'

export type AiModelEffort = 'high' | 'medium' | 'low'

export type AiModel = {
  id: string
  label: string
  description?: string
  efforts?: AiModelEffort[]
  contexts?: Array<string | number>
  supportsFast?: boolean
  supportsThinking?: boolean
  defaultEffort?: AiModelEffort
  defaultContext?: string | number
  defaultFast?: boolean
  defaultThinking?: boolean
  disabled?: boolean
  isGemini?: boolean
}

export type AiModelSelection = {
  id: string
  effort?: AiModelEffort
  context?: string
  fast?: boolean
  thinking?: boolean
}

export type PresenceProps = Pick<
  HTMLMotionProps<'span'>,
  'initial' | 'animate' | 'exit' | 'transition'
>

export interface ModelSelectorProps {
  children: React.ReactNode
  models?: AiModel[]
  value?: AiModelSelection
  defaultValue?: AiModelSelection
  onValueChange?: (value: AiModelSelection) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export interface ModelSelectorTriggerProps extends Omit<
  HTMLMotionProps<'button'>,
  'children'
> {
  children?: React.ReactNode
}

export type ModelSelectorValueProps = React.HTMLAttributes<HTMLSpanElement>

export interface ModelSelectorContentProps extends Omit<
  HTMLMotionProps<'div'>,
  'children'
> {
  children?: React.ReactNode
  side?: 'top' | 'bottom'
}

export interface ModelSelectorKitProps {
  models?: AiModel[]
  value?: AiModelSelection
  defaultValue?: AiModelSelection
  onValueChange?: (value: AiModelSelection) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export interface AiPromptInputProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string, modelSelection?: AiModelSelection) => void
  onStop?: () => void
  models?: AiModel[]
  modelSelection?: AiModelSelection
  defaultModelSelection?: AiModelSelection
  onModelSelectionChange?: (selection: AiModelSelection) => void
  disabled?: boolean
  status?: 'idle' | 'submitted' | 'streaming' | 'error'
  placeholder?: string
  placeholders?: string[]
  placeholderInterval?: number
  maxLength?: number
  minRows?: number
  maxRows?: number
  showToolbar?: boolean
  showActions?: boolean
  showModelSelector?: boolean
  deepResearch?: boolean
  defaultDeepResearch?: boolean
  onDeepResearchChange?: (enabled: boolean) => void
  webSearch?: boolean
  defaultWebSearch?: boolean
  onWebSearchChange?: (enabled: boolean) => void
  onUploadFile?: () => void
  onSkills?: () => void
  onConnectors?: () => void
  onVoiceChange?: (talking: boolean) => void
  className?: string
  textareaClassName?: string
  'aria-label'?: string
  'data-testid'?: string
}

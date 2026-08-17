import { cn } from '@/lib/utils'
import type { AiModel, AiModelEffort, PresenceProps } from './types'

export const EASE = [0.2, 0, 0, 1] as const
export const SPRING_SOFT = { type: 'spring' as const, stiffness: 420, damping: 32 }
export const SPRING_HEIGHT = { type: 'spring' as const, stiffness: 380, damping: 34 }
export const SPRING_PRESS = { type: 'spring' as const, stiffness: 500, damping: 28 }
export const SPRING_ICON = { type: 'spring' as const, duration: 0.3, bounce: 0 }

export const MENU_PANEL_CLASS = cn(
  'bg-surface text-default origin-bottom-left overflow-hidden rounded-2xl border border-border p-1.5',
  'shadow-[0_8px_30px_-8px_rgba(8,8,8,0.18),0_2px_8px_-2px_rgba(8,8,8,0.08)]',
  'dark:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.45),0_2px_8px_-2px_rgba(0,0,0,0.3)]'
)

export const CHIP_SURFACE_CLASS = cn(
  'bg-surface-hover text-default inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2 text-xs font-medium border border-border/70',
  'shadow-xs'
)

export const TOOLBAR_BTN_CLASS = cn(
  'relative flex size-9 cursor-pointer items-center justify-center rounded-xl',
  'transition-[background-color,color,box-shadow,opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
  'hover:bg-surface-hover hover:text-default text-muted',
  'focus-visible:outline-2 focus-visible:outline-primary',
  'disabled:pointer-events-none disabled:opacity-40'
)

export const FADE_ONLY: PresenceProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const ICON_SWAP: PresenceProps = {
  initial: { opacity: 0, scale: 0.25, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.25, filter: 'blur(4px)' },
  transition: SPRING_ICON,
}

export function scaleBlurPresence(reduceMotion: boolean): PresenceProps {
  if (reduceMotion) return FADE_ONLY
  return {
    initial: { opacity: 0, scale: 0.9, filter: 'blur(4px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 0.9, filter: 'blur(4px)' },
    transition: SPRING_ICON,
  }
}

export function menuPresence(reduceMotion: boolean): PresenceProps {
  if (reduceMotion) return FADE_ONLY
  return {
    initial: { opacity: 0, y: 6, scale: 0.96, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, y: 4, scale: 0.98, filter: 'blur(2px)' },
    transition: { duration: 0.2, ease: EASE },
  }
}

export function placeholderPresence(reduceMotion: boolean): PresenceProps {
  if (reduceMotion) return FADE_ONLY
  return {
    initial: { opacity: 0, y: 6, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -6, filter: 'blur(4px)' },
    transition: { duration: 0.35, ease: EASE },
  }
}

export function iconPresence(reduceMotion: boolean): PresenceProps {
  return reduceMotion ? FADE_ONLY : ICON_SWAP
}

export function flyoutPresence(reduceMotion: boolean): PresenceProps {
  if (reduceMotion) return FADE_ONLY
  return {
    initial: { opacity: 0, x: -6, scale: 0.98, filter: 'blur(4px)' },
    animate: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, x: -4, scale: 0.98, filter: 'blur(2px)' },
    transition: { duration: 0.18, ease: EASE },
  }
}

export function valuePresence(reduceMotion: boolean): PresenceProps {
  return reduceMotion ? FADE_ONLY : ICON_SWAP
}

export const DEFAULT_AI_MODELS: AiModel[] = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    description: 'Fast, efficient multimodal AI for rapid test suite generation and review.',
    efforts: ['high', 'medium', 'low'],
    contexts: ['1M', '2M'],
    supportsFast: true,
    supportsThinking: true,
    defaultEffort: 'high',
    defaultContext: '1M',
    defaultFast: true,
    isGemini: true,
  },
  {
    id: 'claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    description: 'Hybrid reasoning and code analysis with deep traceability.',
    efforts: ['high', 'medium', 'low'],
    contexts: ['200K'],
    supportsFast: true,
    supportsThinking: true,
    defaultEffort: 'high',
    defaultContext: '200K',
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    description: 'General-purpose reasoning with strong code generation.',
    efforts: ['high', 'medium', 'low'],
    contexts: ['128K', '400K'],
    supportsFast: true,
    supportsThinking: true,
    defaultEffort: 'medium',
    defaultContext: '128K',
  },
]

export const EFFORT_LABEL: Record<AiModelEffort, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PLACEHOLDER_CYCLE_DEFAULT = [
  'Ask about this project or request a new test suite…',
  'Pregunta sobre el proyecto o solicita una nueva suite…',
  'Suggest test cases for checkout edge cases…',
  'Genera casos de prueba para validación de errores…',
]

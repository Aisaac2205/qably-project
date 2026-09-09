import {
  ArrowsClockwise,
  CircleDashed,
  Code,
  CopySimple,
  Fingerprint,
  ListDashes,
  type Icon,
} from '@phosphor-icons/react'
import type { CaseHealthSignal } from '@qably/types'

export interface CaseHealthSignalPresentation {
  signal: CaseHealthSignal
  labelKey: string
  descriptionKey: string
  Icon: Icon
}

type CaseHealthSignalRegistry = {
  [Signal in CaseHealthSignal]: CaseHealthSignalPresentation
}

export const caseHealthSignalPresentations = {
  'no-steps': {
    signal: 'no-steps',
    labelKey: 'quality.signals.noStepsLabel',
    descriptionKey: 'quality.signals.noStepsDescription',
    Icon: ListDashes,
  },
  'raw-name': {
    signal: 'raw-name',
    labelKey: 'quality.signals.rawNameLabel',
    descriptionKey: 'quality.signals.rawNameDescription',
    Icon: Code,
  },
  'never-run': {
    signal: 'never-run',
    labelKey: 'quality.signals.neverRunLabel',
    descriptionKey: 'quality.signals.neverRunDescription',
    Icon: CircleDashed,
  },
  flaky: {
    signal: 'flaky',
    labelKey: 'quality.signals.flakyLabel',
    descriptionKey: 'quality.signals.flakyDescription',
    Icon: ArrowsClockwise,
  },
  'duplicate-key': {
    signal: 'duplicate-key',
    labelKey: 'quality.signals.duplicateKeyLabel',
    descriptionKey: 'quality.signals.duplicateKeyDescription',
    Icon: Fingerprint,
  },
  'near-duplicate-title': {
    signal: 'near-duplicate-title',
    labelKey: 'quality.signals.nearDuplicateTitleLabel',
    descriptionKey: 'quality.signals.nearDuplicateTitleDescription',
    Icon: CopySimple,
  },
} satisfies CaseHealthSignalRegistry

export const CASE_HEALTH_SIGNAL_ORDER: readonly CaseHealthSignal[] = [
  'no-steps',
  'raw-name',
  'never-run',
  'flaky',
  'duplicate-key',
  'near-duplicate-title',
]

export function getCaseHealthSignalPresentation(
  signal: CaseHealthSignal,
): CaseHealthSignalPresentation {
  return caseHealthSignalPresentations[signal]
}

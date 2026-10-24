'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AuiIf, ComposerPrimitive, useAuiState } from '@assistant-ui/react'
import { Check, FileCode, PaperPlaneRight, Paperclip, Stop, X } from '@phosphor-icons/react'
import { ASSISTANT_MODEL_NAME, isSafeRepoRelativePath, type AttachedCaseRecord } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import { useSuites } from '@/features/projects/suites/hooks/use-suites'
import { MAX_ATTACHED_CASES, flattenAttachableCases } from '@/features/ai-review/lib/attachable-cases'
import { ChatCaseChip } from './chat-case-chip'
import { ChatCasePicker } from './chat-case-picker'
import { ChatFileChip } from './chat-file-chip'
import { ASSISTANT_NAME } from '../lib/assistant-name'

const MAX_MESSAGE_LENGTH = 4000

const toolButtonClass =
  'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition duration-150 ease-out-quart hover:bg-surface-hover hover:text-default active:scale-95 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 md:size-7'

const primaryActionClass =
  'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-fg transition duration-150 ease-out hover:bg-primary-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted disabled:active:scale-100 md:size-8'

export function AerisComposer({
  projectId,
  attachedCases,
  onAttachedCasesChange,
  attachedFilePath,
  onAttachedFilePathChange,
}: {
  projectId: string
  attachedCases: AttachedCaseRecord[]
  onAttachedCasesChange: (cases: AttachedCaseRecord[]) => void
  attachedFilePath: string | null
  onAttachedFilePathChange: (filePath: string | null) => void
}) {
  const { t } = useTranslation()
  const [isFilePathInputOpen, setIsFilePathInputOpen] = useState(false)
  const [filePathDraft, setFilePathDraft] = useState('')
  const [filePathInputError, setFilePathInputError] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { suites } = useSuites(projectId)
  const availableCases = useMemo(() => flattenAttachableCases(suites), [suites])
  const atAttachLimit = attachedCases.length >= MAX_ATTACHED_CASES
  const isRunning = useAuiState((state) => state.thread.isRunning)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stopHadFocusRef = useRef(false)

  // Send and Stop swap places as a reply starts and ends. When the Stop
  // control held focus, hand it to the input instead of dropping it.
  useEffect(() => {
    if (!isRunning && stopHadFocusRef.current) {
      stopHadFocusRef.current = false
      inputRef.current?.focus()
    }
  }, [isRunning])

  const handleSelectCase = (attachedCase: AttachedCaseRecord) => {
    if (!attachedCases.some((existing) => existing.id === attachedCase.id)) {
      onAttachedCasesChange([...attachedCases, attachedCase])
    }
    setPickerOpen(false)
  }

  const handleRemoveCase = (caseId: string) => {
    onAttachedCasesChange(attachedCases.filter((attachedCase) => attachedCase.id !== caseId))
  }

  const closeFilePathInput = () => {
    setIsFilePathInputOpen(false)
    setFilePathDraft('')
    setFilePathInputError(false)
  }

  const handleConfirmFilePath = () => {
    const trimmedPath = filePathDraft.trim()
    if (!isSafeRepoRelativePath(trimmedPath)) {
      setFilePathInputError(true)
      return
    }
    onAttachedFilePathChange(trimmedPath)
    closeFilePathInput()
  }

  const handleFilePathKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleConfirmFilePath()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeFilePathInput()
    }
  }

  // Enter cannot send while a reply streams; keep it from adding a stray
  // newline to the draft. Shift+Enter still breaks the line.
  const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isRunning && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
    }
  }

  return (
    // The strip matches the chat so replies scroll out of sight behind it; the
    // pill is the only surface the composer draws.
    <div className="bg-surface px-3 pt-2 pb-3 sm:px-6 sm:pb-4">
      <ComposerPrimitive.Root className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-3xl border border-border bg-surface px-4 pt-3 pb-2.5 transition-colors focus-within:border-border-strong hover:border-border-strong">
        {(attachedCases.length > 0 || attachedFilePath !== null) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {attachedCases.map((attachedCase) => (
              <ChatCaseChip
                key={attachedCase.id}
                attachedCase={attachedCase}
                onRemove={handleRemoveCase}
              />
            ))}
            {attachedFilePath !== null && (
              <ChatFileChip filePath={attachedFilePath} onRemove={() => onAttachedFilePathChange(null)} />
            )}
          </div>
        )}

        {isFilePathInputOpen && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="aeris-composer-file-path" className="sr-only">
                {t('aiReview.chatFilePathLabel')}
              </label>
              <input
                id="aeris-composer-file-path"
                type="text"
                value={filePathDraft}
                autoFocus
                onChange={(event) => {
                  setFilePathDraft(event.target.value)
                  if (filePathInputError) setFilePathInputError(false)
                }}
                onKeyDown={handleFilePathKeyDown}
                placeholder={t('aiReview.chatFilePathPlaceholder')}
                aria-invalid={filePathInputError}
                aria-describedby={filePathInputError ? 'aeris-composer-file-path-error' : undefined}
                className="h-8 w-full min-w-0 rounded-full border border-border bg-canvas px-3 font-mono text-xs text-default outline-none placeholder:font-sans placeholder:text-muted focus-visible:border-primary aria-invalid:border-fail"
              />
              <button
                type="button"
                onClick={handleConfirmFilePath}
                aria-label={t('common.confirm')}
                title={t('common.confirm')}
                className={toolButtonClass}
              >
                <Check size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={closeFilePathInput}
                aria-label={t('common.cancel')}
                title={t('common.cancel')}
                className={toolButtonClass}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            {filePathInputError && (
              <p id="aeris-composer-file-path-error" role="alert" className="px-1 text-xs text-fail">
                {t('aiReview.chatFilePathInvalid')}
              </p>
            )}
          </div>
        )}

        <label htmlFor="aeris-composer-input" className="sr-only">
          {t('aiReview.chatComposerLabel')}
        </label>
        <ComposerPrimitive.Input
          id="aeris-composer-input"
          ref={inputRef}
          placeholder={t('aiReview.chatPlaceholder')}
          maxLength={MAX_MESSAGE_LENGTH}
          minRows={1}
          maxRows={8}
          submitMode="enter"
          onKeyDown={handleMessageKeyDown}
          className="w-full resize-none bg-transparent text-sm text-default outline-none placeholder:text-muted"
        />

        <div className="-mx-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={atAttachLimit}
              aria-label={t('aiReview.chatAttachCase')}
              title={atAttachLimit ? t('aiReview.chatAttachLimitReached') : t('aiReview.chatAttachCase')}
              className={toolButtonClass}
            >
              <Paperclip size={15} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => {
                setFilePathDraft('')
                setFilePathInputError(false)
                setIsFilePathInputOpen(true)
              }}
              disabled={attachedFilePath !== null}
              aria-label={t('aiReview.chatAttachFile')}
              title={t('aiReview.chatAttachFile')}
              className={toolButtonClass}
            >
              <FileCode size={15} aria-hidden="true" />
            </button>

            {atAttachLimit && (
              <span className="hidden truncate text-xs text-muted sm:inline">
                {t('aiReview.chatAttachLimitReached')}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <p title={ASSISTANT_MODEL_NAME} className="text-sm font-medium text-muted">
              <span className="sr-only">{t('aiReview.modelLabel')}: </span>
              <span>{ASSISTANT_NAME}</span>
            </p>

            <AuiIf condition={(state) => !state.thread.isRunning}>
              <ComposerPrimitive.Send aria-label={t('aiReview.sendMessage')} className={primaryActionClass}>
                <PaperPlaneRight size={16} weight="fill" aria-hidden="true" />
              </ComposerPrimitive.Send>
            </AuiIf>
            <AuiIf condition={(state) => state.thread.isRunning}>
              <ComposerPrimitive.Cancel
                aria-label={t('aiReview.chatStopReply')}
                className={primaryActionClass}
                onFocus={() => {
                  stopHadFocusRef.current = true
                }}
                onBlur={(event) => {
                  if (event.relatedTarget !== null) stopHadFocusRef.current = false
                }}
              >
                <Stop size={14} weight="fill" aria-hidden="true" />
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </div>
        </div>
      </ComposerPrimitive.Root>

      <ChatCasePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        cases={availableCases}
        excludedIds={attachedCases.map((attachedCase) => attachedCase.id)}
        onSelect={handleSelectCase}
        atCap={atAttachLimit}
      />
    </div>
  )
}

'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { Check, FileCode, PaperPlaneRight, Paperclip, X } from '@phosphor-icons/react'
import { ASSISTANT_MODEL_NAME, isSafeRepoRelativePath, type AttachedCaseRecord } from '@qably/types'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { cn } from '@/lib/utils'
import { useAutoResizeTextarea } from '@/features/projects/test-generation/hooks/use-auto-resize-textarea'
import { useTranslation } from '@/lib/i18n'
import { useSuites } from '@/features/projects/suites/hooks/use-suites'
import { MAX_ATTACHED_CASES, flattenAttachableCases } from '@/features/ai-review/lib/attachable-cases'
import { ChatCaseChip } from './chat-case-chip'
import { ChatCasePicker } from './chat-case-picker'
import { ChatFileChip } from './chat-file-chip'

const MIN_HEIGHT = 44
const MAX_HEIGHT = 200
const MAX_MESSAGE_LENGTH = 4000

export function ChatComposer({
  projectId,
  onSend,
  disabled = false,
  initialValue = '',
  initialAttachedCase,
}: {
  projectId: string
  onSend: (text: string, attachedCases?: AttachedCaseRecord[], filePath?: string) => void
  disabled?: boolean
  initialValue?: string
  initialAttachedCase?: AttachedCaseRecord
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const [attachedCases, setAttachedCases] = useState<AttachedCaseRecord[]>(
    initialAttachedCase ? [initialAttachedCase] : [],
  )
  const [attachedFilePath, setAttachedFilePath] = useState<string | null>(null)
  const [isFilePathInputOpen, setIsFilePathInputOpen] = useState(false)
  const [filePathDraft, setFilePathDraft] = useState('')
  const [filePathInputError, setFilePathInputError] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { suites } = useSuites(projectId)
  const availableCases = useMemo(() => flattenAttachableCases(suites), [suites])
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
  })
  const atAttachLimit = attachedCases.length >= MAX_ATTACHED_CASES

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    if (attachedCases.length > 0 && attachedFilePath) {
      onSend(trimmed, attachedCases, attachedFilePath)
    } else if (attachedCases.length > 0) {
      onSend(trimmed, attachedCases)
    } else if (attachedFilePath) {
      onSend(trimmed, undefined, attachedFilePath)
    } else {
      onSend(trimmed)
    }
    setValue('')
    setAttachedCases([])
    setAttachedFilePath(null)
    adjustHeight(true)
  }

  const handleRemoveCase = (caseId: string) => {
    setAttachedCases((current) => current.filter((attachedCase) => attachedCase.id !== caseId))
  }

  const handleSelectCase = (attachedCase: AttachedCaseRecord) => {
    setAttachedCases((current) =>
      current.some((existing) => existing.id === attachedCase.id)
        ? current
        : [...current, attachedCase],
    )
    setPickerOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleOpenFilePathInput = () => {
    setFilePathDraft('')
    setFilePathInputError(false)
    setIsFilePathInputOpen(true)
  }

  const handleCancelFilePathInput = () => {
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
    setAttachedFilePath(trimmedPath)
    setIsFilePathInputOpen(false)
    setFilePathDraft('')
    setFilePathInputError(false)
  }

  const handleFilePathKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleConfirmFilePath()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelFilePathInput()
    }
  }

  const handleRemoveFilePath = () => {
    setAttachedFilePath(null)
  }

  return (
    <div className="bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4 sm:pb-4">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-2 bg-surface border border-border rounded-2xl p-3 shadow-xs hover:border-border-strong focus-within:border-border-strong transition-colors">
          {(attachedCases.length > 0 || attachedFilePath) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {attachedCases.map((attachedCase) => (
                <ChatCaseChip
                  key={attachedCase.id}
                  attachedCase={attachedCase}
                  onRemove={handleRemoveCase}
                />
              ))}
              {attachedFilePath && (
                <ChatFileChip filePath={attachedFilePath} onRemove={handleRemoveFilePath} />
              )}
            </div>
          )}

          {isFilePathInputOpen && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <label htmlFor="chat-composer-file-path" className="sr-only">
                  {t('aiReview.chatFilePathLabel')}
                </label>
                <input
                  id="chat-composer-file-path"
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
                  aria-describedby={filePathInputError ? 'chat-composer-file-path-error' : undefined}
                  className="w-full min-w-0 rounded-lg border border-border bg-canvas px-2 py-1 text-xs text-default placeholder:text-muted outline-none focus-visible:border-border-strong"
                />
                <button
                  type="button"
                  onClick={handleConfirmFilePath}
                  aria-label={t('common.confirm')}
                  title={t('common.confirm')}
                  className="size-7 shrink-0 rounded-lg inline-flex items-center justify-center text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/40 cursor-pointer"
                >
                  <Check size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelFilePathInput}
                  aria-label={t('common.cancel')}
                  title={t('common.cancel')}
                  className="size-7 shrink-0 rounded-lg inline-flex items-center justify-center text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/40 cursor-pointer"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              {filePathInputError && (
                <p id="chat-composer-file-path-error" role="alert" className="px-1 text-[11px] text-fail">
                  {t('aiReview.chatFilePathInvalid')}
                </p>
              )}
            </div>
          )}

          <label htmlFor="chat-composer-input" className="sr-only">
            {t('aiReview.chatComposerLabel')}
          </label>
          <textarea
            id="chat-composer-input"
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              setValue(event.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('aiReview.chatPlaceholder')}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            className="w-full resize-none bg-transparent text-sm text-default placeholder:text-muted outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-canvas/50 px-2 py-1 text-[11px] font-semibold text-muted">
                <AerisIcon size={14} />
                <span className="sr-only">{t('aiReview.modelLabel')}: </span>
                <span className="truncate">{ASSISTANT_MODEL_NAME}</span>
              </p>

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={atAttachLimit}
                aria-label={t('aiReview.chatAttachCase')}
                title={atAttachLimit ? t('aiReview.chatAttachLimitReached') : t('aiReview.chatAttachCase')}
                className="size-7 shrink-0 rounded-lg inline-flex items-center justify-center text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Paperclip size={15} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={handleOpenFilePathInput}
                disabled={attachedFilePath !== null}
                aria-label={t('aiReview.chatAttachFile')}
                title={t('aiReview.chatAttachFile')}
                className="size-7 shrink-0 rounded-lg inline-flex items-center justify-center text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <FileCode size={15} aria-hidden="true" />
              </button>

              {atAttachLimit && (
                <span className="hidden sm:inline text-[11px] text-muted truncate">
                  {t('aiReview.chatAttachLimitReached')}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              aria-label={t('aiReview.sendMessage')}
              className={cn(
                'size-8 shrink-0 rounded-lg flex items-center justify-center transition-all duration-150',
                value.trim() && !disabled
                  ? 'bg-primary text-primary-fg hover:bg-primary-hover shadow-xs active:scale-95'
                  : 'bg-canvas text-muted/40 cursor-not-allowed',
              )}
            >
              <PaperPlaneRight size={16} weight="fill" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

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

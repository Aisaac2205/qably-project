'use client'

/**
 * SuiteForm — full-page create + edit screen for a suite AND its cases.
 *
 * One page, two modes:
 *   - `suite` undefined → create mode (calls createSuite, then createCase
 *     for each drafted case once the suite exists)
 *   - `suite` provided  → edit mode (calls updateSuite with the diff, plus
 *     createCase/updateCase for whatever cases changed)
 *
 * Cases live in a list+editor split (desktop: side by side via
 * ResizableSplit; mobile: one screen at a time, list or editor, since the
 * editor is too tall a form to usefully stack under the list on a phone).
 * A case is only persisted when the whole page is saved — see CaseEntry.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Suite, TestCase } from '@qably/types'
import { CaretLeft, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EntityList } from '@/components/ui/entity-list'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  CaseFields,
  emptyCaseFields,
  type CaseFieldsValue,
} from './case-fields'
import { PriorityBadge } from './priority-badge'
import { describeCase } from '@/features/projects/suites/lib/case-title'
import {
  useCreateSuite,
  useUpdateSuite,
  useCreateCase,
  useUpdateCase,
  useDeleteCase,
} from '@/features/projects/suites/hooks/use-suite-mutations'
import type { CreateCasePayload, UpdateSuitePayload } from '@/features/projects/suites/api/suites.api'
import { useTranslation } from '@/lib/i18n'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { projectSuitesPath } from '@/features/projects/lib/routes'

interface CaseEntry {
  key: string
  caseId?: string
  status: 'draft' | 'persisted'
  automated?: { raw: string; filePath?: string }
  fields: CaseFieldsValue
  original?: CaseFieldsValue
  nameError: boolean
}

function caseEntryFromTestCase(tc: TestCase): CaseEntry {
  const described = describeCase(tc)
  const fields: CaseFieldsValue = {
    name: described.title,
    priority: tc.priority,
    state: tc.state,
    objective: tc.objective,
    preconditions: tc.preconditions,
    steps: tc.steps,
    expectedResult: tc.expectedResult,
  }
  return {
    key: `existing-${tc.id}`,
    caseId: tc.id,
    status: 'persisted',
    automated: described.isAutomated
      ? { raw: described.raw, filePath: tc.automationFilePath }
      : undefined,
    fields,
    original: fields,
    nameError: false,
  }
}

function emptyCaseEntry(key: string): CaseEntry {
  return { key, status: 'draft', fields: emptyCaseFields(), nameError: false }
}

function toCasePayload(fields: CaseFieldsValue): CreateCasePayload {
  return {
    name: fields.name.trim(),
    priority: fields.priority,
    state: fields.state,
    objective: fields.objective.trim(),
    preconditions: fields.preconditions.map((p) => p.trim()).filter(Boolean),
    steps: fields.steps.map((s) => s.trim()).filter(Boolean),
    expectedResult: fields.expectedResult.trim(),
  }
}

function caseChanged(entry: CaseEntry): boolean {
  if (!entry.original) return true
  return JSON.stringify(toCasePayload(entry.fields)) !== JSON.stringify(toCasePayload(entry.original))
}

/**
 * createCase returns the whole updated suite, not the case it just made —
 * find it by diffing against the case ids we already knew about before
 * this call, so a later edit/delete in the same session has a real caseId
 * to target instead of silently no-op'ing.
 */
function findNewCaseId(updatedSuite: Suite, knownIds: Set<string>): string | undefined {
  return updatedSuite.cases.find((c) => !knownIds.has(c.id))?.id
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index])
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function CaseListItem({
  entry,
  isSelected,
  onSelect,
  onDelete,
}: {
  entry: CaseEntry
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const trimmedName = entry.fields.name.trim()

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-2 px-3.5 py-2.5 transition-colors hover:bg-surface-hover',
          isSelected && 'bg-surface-hover',
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-current={isSelected ? 'true' : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-left outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        >
          {entry.nameError && (
            <WarningCircle size={14} weight="fill" className="shrink-0 text-fail" aria-hidden="true" />
          )}
          <span
            className={cn(
              'truncate text-sm font-medium',
              trimmedName ? 'text-default' : 'text-muted italic',
            )}
          >
            {trimmedName || t('suites.untitledCase')}
          </span>
        </button>
        <PriorityBadge priority={entry.fields.priority} />
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('suites.deleteCaseNamed', {
            name: trimmedName || t('suites.untitledCase'),
          })}
          className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted opacity-0 transition-colors hover:bg-fail-bg/40 hover:text-fail focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 group-hover:opacity-100"
        >
          <Trash size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

function CaseListPane({
  cases,
  selectedKey,
  onSelect,
  onAdd,
  onDelete,
  disabled,
  headingRef,
}: {
  cases: CaseEntry[]
  selectedKey: string | undefined
  onSelect: (key: string) => void
  onAdd: () => void
  onDelete: (entry: CaseEntry) => void
  disabled?: boolean
  headingRef?: React.Ref<HTMLHeadingElement>
}) {
  const { t } = useTranslation()

  return (
    <fieldset disabled={disabled} className="contents border-0 p-0">
      <div className="flex h-full min-h-0 flex-col bg-surface">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-3">
          <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-default outline-none">
            {t('suites.testCases')}
            {cases.length > 0 && (
              <span className="ml-1.5 font-mono text-xs font-normal text-muted">{cases.length}</span>
            )}
          </h2>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs font-semibold text-default outline-none transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <Plus size={13} weight="bold" aria-hidden="true" />
            {t('suites.addCase')}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {cases.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted">{t('suites.noTestCases')}</p>
            </div>
          ) : (
            <EntityList aria-label={t('suites.testCases')}>
              {cases.map((entry) => (
                <CaseListItem
                  key={entry.key}
                  entry={entry}
                  isSelected={entry.key === selectedKey}
                  onSelect={() => onSelect(entry.key)}
                  onDelete={() => onDelete(entry)}
                />
              ))}
            </EntityList>
          )}
        </div>
      </div>
    </fieldset>
  )
}

function CaseEditorPane({
  entry,
  onChange,
  onNameErrorClear,
  onBack,
  disabled,
}: {
  entry: CaseEntry | undefined
  onChange: (patch: Partial<CaseFieldsValue>) => void
  onNameErrorClear: () => void
  onBack?: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <StateView
          kind="empty"
          title={t('suites.selectOrAddCaseTitle')}
          description={t('suites.selectOrAddCaseHint')}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3.5 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('suites.backToCases')}
            className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted outline-none transition-colors hover:bg-surface-hover hover:text-default focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <CaretLeft size={14} weight="bold" aria-hidden="true" />
          </button>
        )}
        <h2 className="truncate text-sm font-semibold text-default">
          {entry.fields.name.trim() || t('suites.untitledCase')}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">
        <CaseFields
          value={entry.fields}
          onChange={onChange}
          nameError={entry.nameError}
          onNameErrorClear={onNameErrorClear}
          automated={entry.automated}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

export function SuiteForm({ projectId, suite }: { projectId: string; suite?: Suite }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const isEdit = suite !== undefined
  const isMobile = useIsMobile()

  const createSuiteMutation = useCreateSuite()
  const updateSuiteMutation = useUpdateSuite()
  const createCaseMutation = useCreateCase()
  const updateCaseMutation = useUpdateCase()
  const deleteCaseMutation = useDeleteCase()

  const [name, setName] = useState(suite?.name ?? '')
  const [description, setDescription] = useState(suite?.description ?? '')
  const [tags, setTags] = useState(suite?.tags.join(', ') ?? '')
  const [nameError, setNameError] = useState(false)

  const [draftCounter, setDraftCounter] = useState(() =>
    isEdit && searchParams.get('case') === 'new' ? 1 : 0,
  )
  const [cases, setCases] = useState<CaseEntry[]>(() => {
    const base = (suite?.cases ?? []).map(caseEntryFromTestCase)
    return isEdit && searchParams.get('case') === 'new'
      ? [...base, emptyCaseEntry('draft-0')]
      : base
  })
  const [selectedKey, setSelectedKey] = useState<string | undefined>(() => {
    if (!isEdit) return undefined
    const param = searchParams.get('case')
    if (param === 'new') return 'draft-0'
    if (param !== null && suite?.cases.some((c) => c.id === param)) return `existing-${param}`
    return undefined
  })
  const [deletingCase, setDeletingCase] = useState<CaseEntry | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  const backHref = isEdit ? `/projects/${projectId}/suites/${suite.id}` : projectSuitesPath(projectId)
  const selectedEntry = cases.find((c) => c.key === selectedKey)

  // Moves focus back to the case list heading when a mobile "Back to
  // cases" tap unmounts the editor, so keyboard/screen-reader users don't
  // lose their place to <body>. Only fires on that transition, not on
  // initial mount (where selectedKey already starts undefined).
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousSelectedKey = useRef(selectedKey)
  useEffect(() => {
    if (isMobile && previousSelectedKey.current !== undefined && selectedKey === undefined) {
      listHeadingRef.current?.focus()
    }
    previousSelectedKey.current = selectedKey
  }, [selectedKey, isMobile])

  function addCase() {
    const key = `draft-${draftCounter}`
    setDraftCounter((n) => n + 1)
    setCases((prev) => [...prev, emptyCaseEntry(key)])
    setSelectedKey(key)
  }

  function updateSelectedCaseFields(patch: Partial<CaseFieldsValue>) {
    if (!selectedKey) return
    setCases((prev) =>
      prev.map((c) => (c.key === selectedKey ? { ...c, fields: { ...c.fields, ...patch } } : c)),
    )
  }

  function clearSelectedCaseNameError() {
    if (!selectedKey) return
    setCases((prev) => prev.map((c) => (c.key === selectedKey ? { ...c, nameError: false } : c)))
  }

  function requestDelete(entry: CaseEntry) {
    if (entry.caseId === undefined) {
      setCases((prev) => prev.filter((c) => c.key !== entry.key))
      if (selectedKey === entry.key) setSelectedKey(undefined)
      return
    }
    setDeletingCase(entry)
  }

  function confirmDelete() {
    const entry = deletingCase
    if (!entry?.caseId || !suite) return
    deleteCaseMutation.mutate(
      { suiteId: suite.id, caseId: entry.caseId },
      {
        onSuccess: () => {
          setCases((prev) => prev.filter((c) => c.key !== entry.key))
          if (selectedKey === entry.key) setSelectedKey(undefined)
        },
        onError: () => notify.error(t('suites.saveCaseError')),
      },
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError(true)
      return
    }

    const firstInvalid = cases.find((c) => c.fields.name.trim() === '')
    if (firstInvalid) {
      setCases((prev) => prev.map((c) => (c.key === firstInvalid.key ? { ...c, nameError: true } : c)))
      setSelectedKey(firstInvalid.key)
      return
    }

    setIsSaving(true)
    try {
      if (isEdit) {
        const trimmedDescription = description.trim()
        const patch: UpdateSuitePayload = {}
        if (trimmedName !== suite.name) patch.name = trimmedName
        if (trimmedDescription !== suite.description) patch.description = trimmedDescription
        const tagList = parseTags(tags)
        if (!sameTags(tagList, suite.tags)) patch.tags = tagList
        if (Object.keys(patch).length > 0) {
          await updateSuiteMutation.mutateAsync({ id: suite.id, patch })
        }

        const knownCaseIds = new Set(
          cases.flatMap((c) => (c.caseId !== undefined ? [c.caseId] : [])),
        )
        for (const entry of cases) {
          if (entry.status === 'draft') {
            const updatedSuite = await createCaseMutation.mutateAsync({
              suiteId: suite.id,
              payload: toCasePayload(entry.fields),
            })
            const newCaseId = findNewCaseId(updatedSuite, knownCaseIds)
            if (newCaseId !== undefined) knownCaseIds.add(newCaseId)
            setCases((prev) =>
              prev.map((c) =>
                c.key === entry.key
                  ? { ...c, status: 'persisted', caseId: newCaseId, original: { ...c.fields } }
                  : c,
              ),
            )
          } else if (caseChanged(entry) && entry.caseId !== undefined) {
            await updateCaseMutation.mutateAsync({
              suiteId: suite.id,
              caseId: entry.caseId,
              patch: toCasePayload(entry.fields),
            })
            setCases((prev) =>
              prev.map((c) => (c.key === entry.key ? { ...c, original: { ...c.fields } } : c)),
            )
          }
        }
        router.push(backHref)
      } else {
        const created = await createSuiteMutation.mutateAsync({
          projectId,
          name: trimmedName,
          description: description.trim(),
          tags: parseTags(tags),
        })

        const knownCaseIds = new Set<string>()
        for (const entry of cases) {
          if (entry.status === 'persisted') continue
          const updatedSuite = await createCaseMutation.mutateAsync({
            suiteId: created.id,
            payload: toCasePayload(entry.fields),
          })
          const newCaseId = findNewCaseId(updatedSuite, knownCaseIds)
          if (newCaseId !== undefined) knownCaseIds.add(newCaseId)
          setCases((prev) =>
            prev.map((c) =>
              c.key === entry.key
                ? { ...c, status: 'persisted', caseId: newCaseId, original: { ...c.fields } }
                : c,
            ),
          )
        }
        router.push(`/projects/${projectId}/suites/${created.id}`)
      }
    } catch {
      notify.error(t('suites.saveSuiteError'))
    } finally {
      setIsSaving(false)
    }
  }

  const listPane = (
    <CaseListPane
      cases={cases}
      selectedKey={selectedKey}
      onSelect={setSelectedKey}
      onAdd={addCase}
      onDelete={requestDelete}
      disabled={isSaving}
      headingRef={listHeadingRef}
    />
  )
  const editorPane = (
    <CaseEditorPane
      entry={selectedEntry}
      onChange={updateSelectedCaseFields}
      onNameErrorClear={clearSelectedCaseNameError}
      onBack={isMobile ? () => setSelectedKey(undefined) : undefined}
      disabled={isSaving}
    />
  )

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex h-full min-h-0 w-full flex-col animate-page-enter"
    >
      <div className="flex shrink-0 items-center gap-1.5 px-5 py-4 sm:px-7">
        <Link
          href={backHref}
          aria-label={t('common.back')}
          className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        >
          <CaretLeft size={14} weight="bold" aria-hidden="true" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-default">
          {isEdit ? t('suites.editSuite') : t('suites.newSuite')}
        </h1>
      </div>

      <div className="shrink-0 border-b border-border px-5 pb-5 sm:px-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="suite-name">{t('suites.suiteNameLabel')}</Label>
            <Input
              id="suite-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(false)
              }}
              placeholder={t('suites.suiteNamePlaceholder')}
              aria-invalid={nameError}
              autoFocus
            />
            {nameError && (
              <p role="alert" className="text-xs text-fail">
                {t('suites.suiteNameRequired')}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="suite-tags">{t('suites.tagsLabel')}</Label>
            <Input
              id="suite-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('suites.tagsPlaceholder')}
              aria-describedby="suite-tags-hint"
            />
            <p id="suite-tags-hint" className="text-xs text-muted">
              {t('suites.tagsHint')}
            </p>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="suite-description">{t('suites.suiteDescriptionLabel')}</Label>
            <Textarea
              id="suite-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('suites.suiteDescriptionPlaceholder')}
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isMobile ? (
          selectedEntry ? (
            editorPane
          ) : (
            listPane
          )
        ) : (
          <ResizableSplit
            storageKey="suite-form-split"
            defaultWidth={280}
            minWidth={220}
            maxRatio={0.45}
            className="h-full"
            first={listPane}
            second={editorPane}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3 sm:px-7">
        <Link href={backHref} className={cn(buttonVariants({ variant: 'outline' }))}>
          {t('common.cancel')}
        </Link>
        <Button type="submit" disabled={isSaving}>
          {isEdit ? t('common.save') : t('suites.createSuite')}
        </Button>
      </div>

      <ConfirmDialog
        open={deletingCase !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeletingCase(undefined)
        }}
        title={t('suites.deleteCaseTitle')}
        description={t('suites.deleteCaseDescription', { name: deletingCase?.fields.name ?? '' })}
        onConfirm={confirmDelete}
      />
    </form>
  )
}

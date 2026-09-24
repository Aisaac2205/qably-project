import type { TestCase } from '@qably/types'
import { ChatCircleText, DotsThree, PencilSimple, Sparkle, Trash } from '@phosphor-icons/react'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuPortal,
  MenuPositioner,
  MenuTrigger,
} from '@/components/ui/menu'
import { useTranslation } from '@/lib/i18n'
import { useDocumentCase } from '@/features/projects/suites/hooks/use-suite-mutations'

export interface CaseActionsMenuProps {
  testCase: TestCase
  onEdit: (testCase: TestCase) => void
  onDelete: (testCase: TestCase) => void
  onImproveWithAeris?: (testCase: TestCase) => void
}

export function CaseActionsMenu({
  testCase,
  onEdit,
  onDelete,
  onImproveWithAeris,
}: CaseActionsMenuProps) {
  const { t } = useTranslation()
  const documentCase = useDocumentCase()

  return (
    <Menu>
      <MenuTrigger
        aria-label={t('suites.caseActions')}
        className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      >
        <DotsThree size={16} weight="bold" aria-hidden="true" />
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner align="end">
          <MenuContent>
            <MenuItem onClick={() => onEdit(testCase)}>
              <PencilSimple size={14} aria-hidden="true" />
              {t('suites.editCase')}
            </MenuItem>
            {testCase.executionMode === 'automated' && (
              <MenuItem
                onClick={() =>
                  documentCase.mutate({ suiteId: testCase.suiteId, caseId: testCase.id })
                }
                className="text-ai data-[highlighted]:bg-ai-bg data-[highlighted]:text-ai"
              >
                <Sparkle size={14} aria-hidden="true" />
                {t('suites.redocumentCase')}
              </MenuItem>
            )}
            {onImproveWithAeris && (
              <MenuItem
                onClick={() => onImproveWithAeris(testCase)}
                className="text-ai data-[highlighted]:bg-ai-bg data-[highlighted]:text-ai"
              >
                <ChatCircleText size={14} aria-hidden="true" />
                {t('aiReview.improveWithAeris')}
              </MenuItem>
            )}
            <MenuItem
              onClick={() => onDelete(testCase)}
              className="text-fail data-[highlighted]:bg-fail-bg data-[highlighted]:text-fail"
            >
              <Trash size={14} aria-hidden="true" />
              {t('suites.deleteCase')}
            </MenuItem>
          </MenuContent>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  )
}

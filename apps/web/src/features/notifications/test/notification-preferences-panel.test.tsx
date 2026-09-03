import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationPreferenceView } from '@/features/notifications/api/notifications.api'
import { NotificationPreferencesPanel } from '@/features/notifications/components/notification-preferences-panel'
import { useNotificationPreferences } from '@/features/notifications/hooks/use-notification-preferences'

vi.mock('@/features/notifications/hooks/use-notification-preferences', () => ({
  useNotificationPreferences: vi.fn(),
}))

const useNotificationPreferencesMock = vi.mocked(useNotificationPreferences)

const updatePreferences = vi.fn()

function setPreferences(preferences: NotificationPreferenceView[]) {
  useNotificationPreferencesMock.mockReturnValue({
    preferences,
    isLoading: false,
    isSaving: false,
    updatePreferences,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  updatePreferences.mockResolvedValue([])
  setPreferences([])
})

describe('NotificationPreferencesPanel', () => {
  it('renders one card per event family with a channel-column table', async () => {
    await act(async () => {
      render(<NotificationPreferencesPanel />)
    })

    expect(screen.getByRole('heading', { name: 'Runs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ingestion' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader', { name: 'In-app' })).toHaveLength(3)
    expect(screen.getAllByRole('columnheader', { name: 'Email' })).toHaveLength(3)
  })

  it('renders unset preferences from DEFAULT_NOTIFICATION_PREFERENCES', async () => {
    await act(async () => {
      render(<NotificationPreferencesPanel />)
    })

    expect(screen.getByRole('checkbox', { name: 'Run completed, In-app' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Run completed, Email' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Case regressed, Email' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Connection security, Email' })).toBeChecked()
  })

  it('sends the toggled cell to the api when a checkbox is clicked', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationPreferencesPanel />)
    })

    await user.click(screen.getByRole('checkbox', { name: 'Run failed, Email' }))

    expect(updatePreferences).toHaveBeenCalledWith({
      preferences: [{ eventType: 'run_failed', channel: 'email', enabled: true }],
    })
  })

  it('writes every cell to off when the global switch is turned on', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationPreferencesPanel />)
    })

    await user.click(screen.getByRole('switch', { name: 'Turn everything off' }))

    expect(updatePreferences).toHaveBeenCalledTimes(1)
    const [{ preferences }] = updatePreferences.mock.calls[0]
    expect(preferences).toHaveLength(10)
    expect(preferences.every((p: { enabled: boolean }) => p.enabled === false)).toBe(true)
  })
})

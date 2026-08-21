import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { IntegrationsGovernanceSection } from '@/features/settings/components/integrations-governance-section'

describe('IntegrationsGovernanceSection', () => {
  beforeEach(() => __resetStore())

  it('lists notification credentials while excluding SCM and CI connections', async () => {
    await act(async () => {
      render(<IntegrationsGovernanceSection />)
    })

    const list = screen.getByRole('list', { name: 'Integration credentials' })
    expect(within(list).getByText('Slack')).toBeInTheDocument()
    expect(within(list).getByText('Discord')).toBeInTheDocument()
    expect(within(list).getByText('Jira')).toBeInTheDocument()
    expect(within(list).getByText('Qably Alerts')).toBeInTheDocument()
    expect(within(list).queryByText('GitHub Actions')).not.toBeInTheDocument()
  })

  it('connects a credential from the governance list', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<IntegrationsGovernanceSection />)
    })

    const discordItem = screen.getByText('Discord').closest('li')
    expect(discordItem).not.toBeNull()
    await user.click(within(discordItem!).getByRole('button', { name: 'Connect' }))

    expect(within(discordItem!).getByText('Connected')).toBeInTheDocument()
  })

  it('adds a new notification integration', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<IntegrationsGovernanceSection />)
    })

    const list = screen.getByRole('list', { name: 'Integration credentials' })
    const before = within(list).getAllByRole('listitem').length

    await user.click(screen.getByRole('button', { name: 'Add integration' }))

    expect(within(list).getAllByRole('listitem')).toHaveLength(before + 1)
    expect(within(list).getByText('New integration')).toBeInTheDocument()
  })
})

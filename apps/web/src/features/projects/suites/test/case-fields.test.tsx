import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CaseFields, emptyCaseFields, type CaseFieldsValue } from '@/features/projects/suites/components/case-fields'

function Harness({
  initial = emptyCaseFields(),
  automated,
  nameError = false,
  onNameErrorClear = vi.fn(),
}: {
  initial?: CaseFieldsValue
  automated?: { raw: string; filePath?: string }
  nameError?: boolean
  onNameErrorClear?: () => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <CaseFields
      value={value}
      onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
      nameError={nameError}
      onNameErrorClear={onNameErrorClear}
      automated={automated}
    />
  )
}

describe('CaseFields', () => {
  it('shows the raw automation key and file path as read-only technical context', () => {
    render(
      <Harness
        automated={{
          raw: 'useCreateRun > redirects to dashboard on valid login',
          filePath: 'src/features/runs/hooks/use-create-run.test.ts',
        }}
      />,
    )

    expect(
      screen.getByText('useCreateRun > redirects to dashboard on valid login'),
    ).toBeInTheDocument()
    expect(screen.getByText('src/features/runs/hooks/use-create-run.test.ts')).toBeInTheDocument()
  })

  it('does not show technical context when the case is not automated', () => {
    render(<Harness />)
    expect(screen.queryByText('Raw name')).not.toBeInTheDocument()
  })

  it('prefills the objective field and one row per precondition', () => {
    render(
      <Harness
        initial={{
          ...emptyCaseFields(),
          objective: 'Verify the cart accepts a new item',
          preconditions: ['The cart is empty', 'The user is signed in'],
        }}
      />,
    )

    expect(screen.getByLabelText(/objective/i)).toHaveValue('Verify the cart accepts a new item')
    expect(screen.getByLabelText('Precondition 1')).toHaveValue('The cart is empty')
    expect(screen.getByLabelText('Precondition 2')).toHaveValue('The user is signed in')
  })

  it('reorders steps when moving one down', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ ...emptyCaseFields(), steps: ['First step', 'Second step'] }} />)

    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0])

    const steps = screen.getAllByLabelText(/^Step \d+$/)
    expect(steps[0]).toHaveValue('Second step')
    expect(steps[1]).toHaveValue('First step')
  })

  it('shows a name error and clears it once the user types', async () => {
    const user = userEvent.setup()
    const onNameErrorClear = vi.fn()
    render(<Harness nameError onNameErrorClear={onNameErrorClear} />)

    expect(screen.getByText('A case title is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title'), 'x')
    expect(onNameErrorClear).toHaveBeenCalled()
  })

  it('changes priority through its select', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Priority' }))
    await user.click(await screen.findByRole('option', { name: 'Critical' }))
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveTextContent('Critical')
  })

  it('changes state through its select', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'State' }))
    await user.click(await screen.findByRole('option', { name: 'Draft' }))
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveTextContent('Draft')
  })
})

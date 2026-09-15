import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StepListField } from '@/components/ui/step-list-field'

function Wrapper({ initial }: { initial: string[] }) {
  const [values, setValues] = useState(initial)
  return (
    <StepListField
      label="Steps"
      hint="Executed in order, top to bottom."
      values={values}
      onChange={setValues}
      addLabel="Add step"
      itemPlaceholder="e.g. Click submit"
      itemAriaLabel={(index: number) => `Step ${index + 1}`}
      moveUpLabel="Move up"
      moveDownLabel="Move down"
      removeLabel="Remove"
    />
  )
}

describe('StepListField', () => {
  it('renders one input per value', () => {
    render(<Wrapper initial={['Open page', 'Click submit']} />)
    expect(screen.getByLabelText('Step 1')).toHaveValue('Open page')
    expect(screen.getByLabelText('Step 2')).toHaveValue('Click submit')
  })

  it('adds a new empty row and focuses it when Add is clicked', async () => {
    const user = userEvent.setup()
    render(<Wrapper initial={['Open page']} />)
    await user.click(screen.getByRole('button', { name: 'Add step' }))
    expect(screen.getByLabelText('Step 2')).toHaveValue('')
    expect(screen.getByLabelText('Step 2')).toHaveFocus()
  })

  it('removes a row when its remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<Wrapper initial={['Open page', 'Click submit']} />)
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(screen.queryByDisplayValue('Open page')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Step 1')).toHaveValue('Click submit')
  })

  it('reorders rows with the move up/down buttons', async () => {
    const user = userEvent.setup()
    render(<Wrapper initial={['First', 'Second']} />)
    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0])
    expect(screen.getByLabelText('Step 1')).toHaveValue('Second')
    expect(screen.getByLabelText('Step 2')).toHaveValue('First')
  })

  it('disables move up on the first row and move down on the last row', () => {
    render(<Wrapper initial={['First', 'Second']} />)
    expect(screen.getAllByRole('button', { name: 'Move up' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Move down' })[1]).toBeDisabled()
  })

  it('adds a row and prevents form submission when Enter is pressed on the last row', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Wrapper initial={['Open page']} />
      </form>,
    )
    await user.click(screen.getByLabelText('Step 1'))
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Step 2')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('starts empty with no rows when values is an empty array', () => {
    render(<Wrapper initial={[]} />)
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})

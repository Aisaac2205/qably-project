import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AerisObservations } from '@/components/ui/aeris-observations'

describe('AerisObservations', () => {
  it('renders nothing when the model attached no observations', () => {
    const { container } = render(<AerisObservations observations={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists each observation as plain text under an Aeris heading', () => {
    render(
      <AerisObservations
        observations={['No assertion on the total', '<b>not html</b>']}
      />,
    )

    expect(screen.getByRole('heading', { name: /aeris observations/i })).toBeInTheDocument()
    expect(screen.getByText('No assertion on the total')).toBeInTheDocument()
    expect(screen.getByText('<b>not html</b>')).toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
  })
})

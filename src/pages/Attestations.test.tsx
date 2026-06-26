import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Attestations from './Attestations'

vi.mock('../components/ActivityTimeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/ActivityTimeline')>()
  return {
    ...actual,
    ACTIVITY_ITEMS: [
      {
        id: 'evt-test-1',
        timestamp: 'Test UTC',
        title: 'Attestation submitted',
        description: 'Identity evidence.',
        actor: 'Validator',
        statusLabel: 'Accepted',
        tone: 'success',
        meta: 'Tx 0x123',
      }
    ]
  }
})

describe('Attestations Page', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders timeline items and filter', () => {
    render(<Attestations />)
    expect(screen.getByRole('heading', { name: /attestations/i, level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('filters rows when a tone is selected', () => {
    render(<Attestations />)
    const filterSelect = screen.getByRole('combobox', { name: /filter attestations/i })
    
    fireEvent.change(filterSelect, { target: { value: 'success' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Attestation submitted')).toBeInTheDocument()
  })

  it('shows empty state when filter yields no results', () => {
    render(<Attestations />)
    const filterSelect = screen.getByRole('combobox', { name: /filter attestations/i })
    
    fireEvent.change(filterSelect, { target: { value: 'warning' } })
    
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
  })

  it('expands row details on click', () => {
    render(<Attestations />)
    const expandBtn = screen.getByRole('button', { name: /show details/i })
    
    expect(screen.queryByText(/Tx 0x123/)).not.toBeInTheDocument()
    fireEvent.click(expandBtn)
    
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Tx 0x123/)).toBeInTheDocument()
    expect(screen.getByText(/Validator/)).toBeInTheDocument()
  })
})

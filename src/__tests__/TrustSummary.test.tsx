import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, test, expect, vi } from 'vitest'
import TrustSummary from '../pages/TrustSummary'

// Mock hooks and components used in TrustSummary
vi.mock('../hooks/useTrustScore', () => ({
  useTrustScore: vi.fn(() => ({
    data: { score: 500, tier: 'gold' },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: vi.fn(() => ({ copy: vi.fn(), copied: false })),
  useCopyToClipboard: vi.fn(() => ({ copy: vi.fn(), copied: false })),
}))

vi.mock('@/lib/stellar', () => ({
  isValidStellarAddress: vi.fn((addr) => !!addr),
}))

vi.mock('../components/Badge', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="badge" {...props} />,
}))

vi.mock('../components/TrustGauge', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="gauge" {...props} />,
}))

vi.mock('../components/TierLadder', () => ({
  default: () => <div data-testid="ladder" />,
}))

vi.mock('../components/states', () => ({
  EmptyState: ({
    title,
    message,
    description,
  }: {
    title?: string
    message?: string
    description?: string
  }) => (
    <div data-testid="empty">
      <h2>{title}</h2>
      <p>{description || message}</p>
    </div>
  ),
  ErrorState: (props: Record<string, unknown>) => <div data-testid="error" {...props} />,
  LoadingSkeleton: (props: Record<string, unknown>) => <div data-testid="loading" {...props} />,
}))

describe('TrustSummary component', () => {
  test('renders summary for valid address', () => {
    render(
      <MemoryRouter initialEntries={['/trust/summary?address=GABCD12345']}>
        <Routes>
          <Route path="/trust/summary" element={<TrustSummary />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: /trust summary/i })).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByTestId('gauge')).toBeInTheDocument()
    expect(screen.getByTestId('ladder')).toBeInTheDocument()
  })

  test('shows empty state when address missing', () => {
    render(
      <MemoryRouter initialEntries={['/trust/summary']}>
        <Routes>
          <Route path="/trust/summary" element={<TrustSummary />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByTestId('empty')).toBeInTheDocument()
    expect(screen.getByText(/no address supplied/i)).toBeInTheDocument()
  })

  test('Print button triggers window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/trust/summary?address=GABCD12345']}>
        <Routes>
          <Route path="/trust/summary" element={<TrustSummary />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(printSpy).toHaveBeenCalled()
  })
})

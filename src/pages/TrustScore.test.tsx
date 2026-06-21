import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TrustScore from './TrustScore'

const mockAddToast = vi.fn()

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

describe('TrustScore', () => {
  it('renders the tier ladder explainer and empty activity state', () => {
    render(<TrustScore />)

    expect(screen.getByRole('heading', { name: 'Trust Score' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /how trust is earned/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No recent activity' })).toBeInTheDocument()
    expect(
      screen.getByText(/New trust score events will appear here once bonds/i)
    ).toBeInTheDocument()
  })

  it('keeps lookup disabled until the address input reports valid input', () => {
    render(<TrustScore />)

    expect(screen.getByRole('button', { name: /look up score/i })).toBeDisabled()
  })
})

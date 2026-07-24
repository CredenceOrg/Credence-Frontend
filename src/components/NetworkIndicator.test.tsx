import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NetworkIndicator from './NetworkIndicator'
import { useSettings, type SettingsState } from '../context/SettingsContext'

vi.mock('../context/SettingsContext', () => ({
  useSettings: vi.fn(),
}))

describe('NetworkIndicator', () => {
  it('renders "Mainnet" pill for public network', () => {
    vi.mocked(useSettings).mockReturnValue({ network: 'public' } as Partial<SettingsState> as SettingsState)
    render(<NetworkIndicator />)
    expect(screen.getByText('Mainnet')).toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Mainnet')).toBeInTheDocument()
  })

  it('renders "Testnet" pill for test network', () => {
    vi.mocked(useSettings).mockReturnValue({ network: 'test' } as Partial<SettingsState> as SettingsState)
    render(<NetworkIndicator />)
    expect(screen.getByText('Testnet')).toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Testnet')).toBeInTheDocument()
  })

  it('renders "Unknown" pill for unknown network', () => {
    vi.mocked(useSettings).mockReturnValue({ network: 'other' } as Partial<SettingsState> as SettingsState)
    render(<NetworkIndicator />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Unknown')).toBeInTheDocument()
  })
})

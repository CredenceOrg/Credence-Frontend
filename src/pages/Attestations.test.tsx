import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import Attestations from './Attestations'
import { truncateAddress } from '../lib/stellar'
import Attestations, { formatTimestamp } from './Attestations'

const WALLET_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

const walletState = vi.hoisted(() => ({
  address: '',
  isConnected: false,
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: () => walletState,
}))

vi.mock('../components/AttestationForm', () => ({
  default: ({
    onSubmitSuccess,
  }: {
    onSubmitSuccess: (payload: { subject: string; type: string; evidence: string }) => void
  }) => (
    <button
      type="button"
      onClick={() =>
        onSubmitSuccess({
          subject: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
          type: 'identity',
          evidence: 'Identity evidence package',
        })
      }
    >
      Submit attestation
    </button>
  ),
}))

const renderInRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

async function submitAttestation() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /submit attestation/i }))
  return user
}

describe('Attestations page', () => {
  beforeEach(() => {
    walletState.address = ''
    walletState.isConnected = false
  })

  afterEach(cleanup)

  it('renders the header, form, timeline, and status filter', () => {
    renderInRouter(<Attestations />)

    expect(
      screen.getByRole('heading', { name: /^attestations$/i, level: 1 })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit attestation/i })).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: /recent timeline events/i })
    ).toBeInTheDocument()

    const filter = screen.getByRole('combobox', { name: /filter attestations/i })
    expect(filter).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('filters the timeline by status', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    const filter = screen.getByRole('combobox', { name: /filter attestations/i })

    // 5 sample items: 2 accepted, 2 needs-update, 1 in-review
    expect(screen.getAllByRole('listitem')).toHaveLength(5)

    await user.selectOptions(filter, 'success')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await user.selectOptions(filter, 'warning')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await user.selectOptions(filter, 'info')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.selectOptions(filter, 'all')
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('uses the connected wallet address as the actor on submit', async () => {
    walletState.address = WALLET_ADDRESS
    walletState.isConnected = true
    renderInRouter(<Attestations />)

    const user = await submitAttestation()
    await user.click(screen.getAllByRole('button', { name: /show details/i })[0]!)

    const actor = document.querySelector('.activity-row__actor')
    expect(actor?.textContent).toContain(truncateAddress(WALLET_ADDRESS))
    expect(actor?.textContent).not.toContain('Current User')
  })

  it('falls back to the translated label when disconnected', async () => {
    renderInRouter(<Attestations />)

    const user = await submitAttestation()
    await user.click(screen.getAllByRole('button', { name: /show details/i })[0]!)

    expect(document.querySelector('.activity-row__actor')?.textContent).toContain('Current User')
  })

  it('stores new activity timestamps as ISO values', async () => {
    renderInRouter(<Attestations />)
    await submitAttestation()

    const time = screen.getAllByRole('listitem')[0]!.querySelector('time')
    expect(time).not.toBeNull()
    expect(time?.getAttribute('dateTime')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
    expect(time?.textContent).not.toContain('T')
  })
})

describe('formatTimestamp', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('formats the current system time in UTC regardless of local timezone', () => {
    vi.stubEnv('TZ', 'America/New_York')
    const fixedDate = new Date('2026-06-15T23:45:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(fixedDate)

    const localeSpy = vi.spyOn(Date.prototype, 'toLocaleDateString')

    const result = formatTimestamp()

    expect(localeSpy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ timeZone: 'UTC', hour12: false })
    )
    expect(result).toBe(
      fixedDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }) + ' UTC'
    )
    expect(result).toContain('23:45')
    expect(result.endsWith(' UTC')).toBe(true)
  })
})

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import Attestations from './Attestations'
import { truncateAddress } from '../lib/stellar'
import Attestations, { formatTimestamp } from './Attestations'
import { clearApiQueryCache } from '../hooks/useApiQuery'
import { resetIdempotentOperationStore } from '../lib/idempotentOperation'
import { ApiError } from '../api/client'
import type { Attestation } from '../api/types'

const WALLET_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

const walletState = vi.hoisted(() => ({
  address: '',
  isConnected: false,
  network: 'test',
}))

const addToastMock = vi.hoisted(() => vi.fn())
const apiFetchMock = vi.hoisted(() => vi.fn())

vi.mock('../context/WalletContext', () => ({
  useWallet: () => walletState,
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ network: 'test' }),
}))

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}))

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return {
    ...actual,
    apiFetch: apiFetchMock,
  }
})

vi.mock('../components/AttestationForm', () => ({
  default: ({
    onSubmitSuccess,
    disabled,
  }: {
    onSubmitSuccess: (payload: {
      subject: string
      type: string
      evidence: string
    }) => void | Promise<unknown>
    disabled?: boolean
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const res = onSubmitSuccess({
          subject: WALLET_ADDRESS,
          type: 'identity',
          evidence: 'Identity evidence package',
        })
        if (res && typeof (res as Promise<unknown>).catch === 'function') {
          ;(res as Promise<unknown>).catch(() => {})
        }
      }}
    >
      Submit attestation
    </button>
  ),
}))

const SAMPLE_ATTESTATIONS: Attestation[] = [
  {
    id: 'att-001',
    subject: WALLET_ADDRESS,
    type: 'identity',
    evidence: 'Identity evidence package uploaded and signed for review.',
    actor: 'Validator Node 12',
    status: 'accepted',
    createdAt: '2026-04-28T14:22:00.000Z',
    meta: 'Tx 0x93a1...22f4',
  },
  {
    id: 'att-002',
    subject: WALLET_ADDRESS,
    type: 'peer-vouch',
    evidence: 'Signature payload differed from expected checksum for one field.',
    actor: 'Automated Verifier',
    status: 'needs-update',
    createdAt: '2026-04-27T09:48:00.000Z',
    meta: 'Rule AV-17',
  },
  {
    id: 'att-003',
    subject: WALLET_ADDRESS,
    type: 'credential',
    evidence: 'Expiration window extended after successful periodic check.',
    actor: 'System process',
    status: 'in-review',
    createdAt: '2026-04-26T20:11:00.000Z',
    meta: 'Window +90d',
  },
  {
    id: 'att-004',
    subject: WALLET_ADDRESS,
    type: 'identity',
    evidence: 'USDC bond locked against your wallet address.',
    actor: 'Validator Node 04',
    status: 'accepted',
    createdAt: '2026-04-25T12:01:00.000Z',
    meta: 'Tx 0xa37c...91de',
  },
  {
    id: 'att-005',
    subject: WALLET_ADDRESS,
    type: 'credential',
    evidence: 'Certification document is older than the 90-day threshold.',
    actor: 'Automated Verifier',
    status: 'needs-update',
    createdAt: '2026-04-24T16:33:00.000Z',
    meta: 'Rule CR-04',
  },
]

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
    walletState.network = 'test'
    addToastMock.mockReset()
    apiFetchMock.mockReset()
    clearApiQueryCache()
    resetIdempotentOperationStore()

    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'POST' && path === '/attestations') {
        const actor =
          walletState.isConnected && walletState.address
            ? truncateAddress(walletState.address)
            : 'Current User'
        return Promise.resolve({
          id: 'att-created-1',
          subject: WALLET_ADDRESS,
          type: 'identity',
          evidence: 'Identity evidence package',
          actor,
          status: 'accepted',
          createdAt: new Date().toISOString(),
        } satisfies Attestation)
      }
      return Promise.resolve({ items: SAMPLE_ATTESTATIONS })
    })
  })

  afterEach(cleanup)

  it('renders the header, form, timeline, and status filter', async () => {
    renderInRouter(<Attestations />)

    expect(
      screen.getByRole('heading', { name: /^attestations$/i, level: 1 })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit attestation/i })).toBeInTheDocument()

    expect(
      await screen.findByRole('list', { name: /recent timeline events/i })
    ).toBeInTheDocument()

    const filter = screen.getByRole('combobox', { name: /filter attestations/i })
    expect(filter).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('filters the timeline by status', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    await screen.findByRole('list', { name: /recent timeline events/i })

    const filter = screen.getByRole('combobox', { name: /filter attestations/i })

    // 5 fetched items: 2 accepted, 2 needs-update, 1 in-review
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

  it('uses the connected wallet address as the actor on submit and sends an idempotency key', async () => {
    walletState.address = WALLET_ADDRESS
    walletState.isConnected = true
    renderInRouter(<Attestations />)
    await screen.findByRole('list', { name: /recent timeline events/i })

    const user = await submitAttestation()
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(6)
    })

    const postCall = apiFetchMock.mock.calls.find(
      ([path, opts]) => path === '/attestations' && opts?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    expect(postCall?.[1]?.idempotencyKey).toMatch(/^att-/)

    await user.click(screen.getAllByRole('button', { name: /show details/i })[0]!)
    const actor = document.querySelector('.activity-row__actor')
    expect(actor?.textContent).toContain(truncateAddress(WALLET_ADDRESS))
    expect(actor?.textContent).not.toContain('Current User')
  })

  it('falls back to the translated label when disconnected', async () => {
    renderInRouter(<Attestations />)
    await screen.findByRole('list', { name: /recent timeline events/i })
  it('shows attestation-specific empty state when filter yields no results', async () => {
    const user = userEvent.setup()
    render(<Attestations />)
    screen.getByRole('combobox', { name: /filter attestations/i })

    const user = await submitAttestation()
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(6)
    })

    await user.click(screen.getAllByRole('button', { name: /show details/i })[0]!)
    expect(document.querySelector('.activity-row__actor')?.textContent).toContain('Current User')
  })

  it('stores new activity timestamps as ISO values', async () => {
    renderInRouter(<Attestations />)
    await screen.findByRole('list', { name: /recent timeline events/i })

    await submitAttestation()
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(6)
    })

    const time = screen.getAllByRole('listitem')[0]!.querySelector('time')
    expect(time).not.toBeNull()
    expect(time?.getAttribute('dateTime')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
    expect(time?.textContent).not.toContain('T')
  })

  it('rolls back the optimistic row and shows an error toast when submit fails', async () => {
    let rejectPost!: (err: Error) => void
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'POST' && path === '/attestations') {
        return new Promise((_resolve, reject) => {
          rejectPost = reject
        })
      }
      return Promise.resolve({ items: SAMPLE_ATTESTATIONS })
    })

    renderInRouter(<Attestations />)
    await screen.findByRole('list', { name: /recent timeline events/i })
    expect(screen.getAllByRole('listitem')).toHaveLength(5)

    await submitAttestation()

    // Optimistic row appears immediately before the request settles
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(6)
    })

    // Server rejects the submission
    rejectPost(new ApiError(500, 'Submission failed on server'))

    // Optimistic row is rolled back and error toast is shown
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(5)
    })
    expect(addToastMock).toHaveBeenCalledWith('danger', 'Submission failed on server')
  })

  it('renders an error state when loading attestations fails', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(503, 'Service unavailable'))

    renderInRouter(<Attestations />)

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
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
    // Panel is hidden — use queryByTestId since CopyableHash is not mocked here
    expect(screen.queryByTestId('copyable-hash')).not.toBeInTheDocument()
    const expandBtn = screen.getAllByRole('button', { expanded: false })[0]!
    fireEvent.click(expandBtn)

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

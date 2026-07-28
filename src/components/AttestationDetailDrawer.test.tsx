import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttestationDetailDrawer from './AttestationDetailDrawer'
import type { ActivityItem } from '../events'

const LABELS = {
  closeAria: 'Close attestation details',
  closeText: 'Close',
  validator: 'Validator',
  transaction: 'Transaction hash',
  rule: 'Rule',
  windowOrNote: 'Note',
  evidence: 'Evidence',
  timestamp: 'Timestamp',
  viewOnExplorer: 'View on Stellar Explorer',
  emptyTitle: 'No attestation selected',
}

const SAMPLE_TX: ActivityItem = {
  id: 'd-1',
  timestamp: 'Apr 28, 14:22 UTC',
  title: 'Identity attestation confirmed',
  description: 'Identity evidence package uploaded and signed for review.',
  actor: 'Validator Node 12',
  statusLabel: 'Accepted',
  tone: 'success',
  meta: 'Tx 0x93a1c4d2...22f4',
  status: 'accepted',
}

const SAMPLE_RULE: ActivityItem = {
  id: 'd-2',
  timestamp: 'Apr 27, 09:48 UTC',
  title: 'Peer vouch mismatch detected',
  description: 'Signature payload differed.',
  actor: 'Automated Verifier',
  statusLabel: 'Needs update',
  tone: 'warning',
  meta: 'Rule AV-17',
  status: 'needs-update',
}

const SAMPLE_NOTE: ActivityItem = {
  id: 'd-3',
  timestamp: 'Apr 26, 20:11 UTC',
  title: 'Credential refreshed',
  description: 'Expiration window extended.',
  actor: 'System process',
  statusLabel: 'In review',
  tone: 'info',
  meta: 'Window +90d',
  status: 'in-review',
}

const renderDrawer = (
  ui: React.ReactElement,
  options: { container?: HTMLElement | null } = {}
) => render(ui, { container: options.container ?? document.body })

describe('AttestationDetailDrawer', () => {
  afterEach(cleanup)

  it('renders nothing when closed', () => {
    renderDrawer(
      <AttestationDetailDrawer open={false} item={SAMPLE_TX} onClose={() => {}} labels={LABELS} />
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders a dialog with the item title, status badge, and rows', () => {
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_TX} onClose={() => {}} labels={LABELS} />
    )
    const dialog = screen.getByRole('dialog', {
      name: /identity attestation confirmed/i,
    })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent(/validator node 12/i)
    expect(dialog).toHaveTextContent(/identity evidence package uploaded/i)
    expect(dialog).toHaveTextContent(/transaction hash/i)
    expectedTimestamp(dialog, SAMPLE_TX.timestamp)
  })

  it('renders "Rule" section when meta starts with "Rule"', () => {
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_RULE} onClose={() => {}} labels={LABELS} />
    )
    expect(screen.getByText('Rule')).toBeInTheDocument()
    expect(screen.getByText('AV-17')).toBeInTheDocument()
  })

  it('renders "Note" section for non-tx meta that\'s not a rule', () => {
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_NOTE} onClose={() => {}} labels={LABELS} />
    )
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText(/Window \+90d/)).toBeInTheDocument()
  })

  it('closes on Escape via the focus trap', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_TX} onClose={onClose} labels={LABELS} />
    )
    const dialog = screen.getByRole('dialog')
    // Initial focus is set via requestAnimationFrame inside useFocusTrap;
    // waitFor races with jsdom's rAF polyfill so we don't peek too early.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_TX} onClose={onClose} labels={LABELS} />
    )
    await user.click(screen.getByRole('button', { name: /close attestation details/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('does NOT close when a click starts inside the drawer (e.g. on CopyableHash elements)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_TX} onClose={onClose} labels={LABELS} />
    )
    // Click inside dialog (e.g., the title block) — backdrop "started
    // outside" guard plus the dialog's onClick-stopPropagation should keep
    // the drawer open and onClose must not fire.
    const dialog = screen.getByRole('dialog')
    await user.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when the click started outside the drawer on the backdrop', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_TX} onClose={onClose} labels={LABELS} />
    )
    const backdrop = document.querySelector('.attestationDrawer__backdrop') as HTMLElement
    expect(backdrop).not.toBeNull()
    // Simulate pointerdown on the backdrop. The drawer records
    // "started outside" when target === currentTarget, so onClose fires
    // on the trailing click.
    fireMouseDownOnBackdrop(backdrop)
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('focus is trapped — Tab cycles within the dialog', async () => {
    const user = userEvent.setup()
    renderDrawer(
      <AttestationDetailDrawer open item={SAMPLE_TX} onClose={() => {}} labels={LABELS} />
    )
    const dialog = screen.getByRole('dialog')
    // Initial focus is set via rAF; wait for it before iterating
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('renders the empty state when item is null but open=true', () => {
    renderDrawer(
      <AttestationDetailDrawer open item={null} onClose={() => {}} labels={LABELS} />
    )
    const dialog = screen.getByRole('dialog', { name: /no attestation selected/i })
    expect(dialog).toBeInTheDocument()
    // The empty body copy lives inside an element with role="status" so
    // scope the assertion to that node — otherwise the same text appears
    // in both the h2 and the body and the matching is ambiguous.
    expect(
      screen.getByRole('status').textContent
    ).toMatch(/no attestation selected/i)
  })
})

function expectedTimestamp(dialog: HTMLElement, ts: string) {
  const time = dialog.querySelector('time')
  expect(time).not.toBeNull()
  expect(time?.textContent).toContain(ts)
}

function fireMouseDownOnBackdrop(target: HTMLElement) {
  // Simulate pointerdown on the backdrop. The drawer's handler records
  // "started outside" when target === currentTarget.
  const evt = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  target.dispatchEvent(evt)
}

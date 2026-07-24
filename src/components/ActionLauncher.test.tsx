import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionLauncher from './ActionLauncher'

function renderLauncher(overrides: Partial<Parameters<typeof ActionLauncher>[0]> = {}) {
  const onClose = vi.fn()
  const onOpenKeyboardShortcuts = vi.fn()
  const props = {
    open: true,
    onClose,
    returnFocusRef: undefined,
    onOpenKeyboardShortcuts,
    ...overrides,
  }
  const result = render(
    <MemoryRouter>
      <ActionLauncher {...props} />
    </MemoryRouter>,
  )
  return { ...result, onClose, onOpenKeyboardShortcuts }
}

describe('ActionLauncher', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders search input and action list when open', () => {
    renderLauncher()
    expect(screen.getByRole('textbox', { name: /search actions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /actions/i })).toBeInTheDocument()
  })

  it('filters actions with fuzzy matching', async () => {
    const user = userEvent.setup()
    renderLauncher()

    const input = screen.getByRole('textbox', { name: /search actions/i })
    await user.type(input, 'dash')

    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /settings/i })).toBeNull()
  })

  it('shows a no results message when there are no matches', async () => {
    const user = userEvent.setup()
    renderLauncher()

    const input = screen.getByRole('textbox', { name: /search actions/i })
    await user.type(input, 'zzzz')

    expect(screen.getByText(/no matching actions/i)).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderLauncher()

    await user.click(screen.getByRole('button', { name: /close command launcher/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('opens keyboard shortcuts help when the corresponding action is selected', async () => {
    const user = userEvent.setup()
    const { onOpenKeyboardShortcuts } = renderLauncher()

    await user.click(screen.getByRole('button', { name: /keyboard shortcuts/i }))
    expect(onOpenKeyboardShortcuts).toHaveBeenCalledOnce()
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionCard from './ActionCard'

vi.mock('./ActionCard.css', () => ({}))

const mockAddToast = vi.fn()
const mockCopy = vi.fn()

vi.mock('./ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
    removeAllToasts: vi.fn(),
    announce: vi.fn(),
  }),
}))

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: () => ({ copy: mockCopy, copied: false, reset: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'dashboard.copyLink': 'Copy link to this card',
        'dashboard.linkCopied': 'Link copied to clipboard',
        'dashboard.linkCopyFailed': 'Unable to copy link',
        'dashboard.closeCard': 'Close card',
      }
      return translations[key] || options?.defaultValue || key
    },
  }),
}))

describe('ActionCard', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
    mockCopy.mockClear()
  })
  it('renders title as an <h2> and children', () => {
    render(<ActionCard title="Test Title">Test Content</ActionCard>)
    const title = screen.getByRole('heading', { level: 2, name: 'Test Title' })
    expect(title).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    const { container } = render(<ActionCard title="Test Title">Test Content</ActionCard>)
    const article = container.querySelector('article')
    expect(article).toHaveClass('actionCard')
    expect(article).toHaveClass('actionCard--comfortable')
    expect(article).not.toHaveClass('actionCard--elevated')
  })

  it('applies compact padding modifier', () => {
    const { container } = render(
      <ActionCard title="Test" padding="compact">
        Content
      </ActionCard>
    )
    const article = container.querySelector('article')
    expect(article).toHaveClass('actionCard--compact')
  })

  it('applies elevated modifier', () => {
    const { container } = render(
      <ActionCard title="Test" elevated>
        Content
      </ActionCard>
    )
    const article = container.querySelector('article')
    expect(article).toHaveClass('actionCard--elevated')
  })

  it('renders a copy-link button when shareableLink is provided', async () => {
    const user = userEvent.setup()
    mockCopy.mockResolvedValue(true)

    render(
      <ActionCard title="Test Title" shareableLink="https://example.com/dashboard?widget=test">
        Content
      </ActionCard>
    )

    const copyButton = screen.getByRole('button', { name: 'Copy link to this card' })
    expect(copyButton).toBeInTheDocument()

    await user.click(copyButton)

    expect(mockCopy).toHaveBeenCalledWith('https://example.com/dashboard?widget=test')
    expect(mockAddToast).toHaveBeenCalledWith('success', 'Link copied to clipboard')
  })

  it('does not render a copy-link button when shareableLink is omitted', () => {
    render(<ActionCard title="Test Title">Content</ActionCard>)

    expect(screen.queryButton('Copy link to this card')).not.toBeInTheDocument()
  })

  it('shows an error toast and invokes onCopyError when copy returns false', async () => {
    const user = userEvent.setup()
    const onCopyError = vi.fn()
    mockCopy.mockResolvedValue(false)

    render(
      <ActionCard
        title="Test Title"
        shareableLink="https://example.com/dashboard?widget=test"
        onCopyError={onCopyError}
      >
        Content
      </ActionCard>
    )

    await user.click(screen.getByButton('Copy link to this card'))

    expect(mockCopy).toHaveBeenCalledTimes(1)
    expect(mockAddToast).toHaveBeenCalledWith('error', 'Unable to copy link')
    expect(onCopyError).toHaveBeenCalledOnce()
  })

  it('shows an error toast and invokes onCopyError when copy rejects', async () => {
    const user = userEvent.setup()
    const onCopyError = vi.fn()
    const failure = new Error('clipboard denied')
    mockCopy.mockRejected(failure)

    render(
      <ActionCard
        title="Test Title"
        shareableLink="https://example.com/dashboard?widget=test"
        onCopyError={onCopyError}
      >
        Content
      </ActionCard>
    )

    await user.click(screen.getButton('Copy link to this card'))

    expect(mockAddToast).toHaveBeenCalledWith('error', 'Unable to copy link')
    expect(onCopyError).toHaveBeenCalledWith(failure)
  })

  it('swallows concurrent clicks while a copy is in flight', async () => {
    const user = userEvent.setup()
    let resolveCopy: ((value: boolean) => void) | undefined
    mockCopy.mockImplementation(
      () =>
        new Promise<boolean~((resolve) => {
          resolveCopy = resolve
        })
    )

    render(
      <ActionCard title="Test Title" shareableLink="https://example.com/dashboard?widget=test">
        Content
      </ActionCard>
    )

    const copyButton = screen.getButton('Copy link to this card')
    await user.click(copyButton)
    await user.click(copyButton)

    expect(mockCopy).toHaveBeenCalledTimes(1)

    resolveCopy?.(true)
    await waitFor(() => expect(mockAddToast).toHaveBeenCalledTimes(1))
  })

  it('renders a beta ribbon when isEarlyAccess is true', () => {
    render(
      <ActionCard title="Beta Feature" isEarlyAccess>
        Content
      </ActionCard>
    )
    expect(screen.getByText('BETA')).toBeInTheDocument()
  })

  it('renders close button when onDismiss is provided', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <ActionCard title="Test" onDismiss={onDismiss}>
        Content
      </ActionCard>
    )
    const closeBtn = screen.getByButton('Close card')
    expect(closeBtn).toBeInTheDocument()

    await user.click(closeBtn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

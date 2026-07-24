import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionCard from './ActionCard'

vi.mock('./ActionCard.css', () => ({}))

const mockAddToast = vi.fn()
const mockCopy = vi.fn()

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn(), removeAllToasts: vi.fn(), announce: vi.fn() }),
}))

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: () => ({ copy: mockCopy, copied: false, reset: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'dashboard.copyLink': 'Copy link to this card',
        'dashboard.linkCopied': 'Link copied to clipboard',
      }
      return translations[key] || key
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

    render(<ActionCard title="Test Title" shareableLink="https://example.com/dashboard?widget=test">Content</ActionCard>)

    const copyButton = screen.getByRole('button', { name: 'Copy link to this card' })
    expect(copyButton).toBeInTheDocument()

    await user.click(copyButton)

    expect(mockCopy).toHaveBeenCalledWith('https://example.com/dashboard?widget=test')
    expect(mockAddToast).toHaveBeenCalledWith('success', 'Link copied to clipboard')
  })

  it('does not render a copy-link button when shareableLink is omitted', () => {
    render(<ActionCard title="Test Title">Content</ActionCard>)

    expect(screen.queryByRole('button', { name: 'Copy link to this card' })).not.toBeInTheDocument()
  })

  it('does not show toast when copy fails', async () => {
    const user = userEvent.setup()
    mockCopy.mockResolvedValue(false)

    render(<ActionCard title="Test Title" shareableLink="https://example.com/dashboard?widget=test">Content</ActionCard>)

    await user.click(screen.getByRole('button', { name: 'Copy link to this card' }))

    expect(mockCopy).toHaveBeenCalledTimes(1)
    expect(mockAddToast).not.toHaveBeenCalled()
  })
})

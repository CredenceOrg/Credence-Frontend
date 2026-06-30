import { render, screen } from '@testing-library/react'
import ActionCard from './ActionCard'

vi.mock('./ActionCard.css', () => ({}))

describe('ActionCard', () => {
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
})

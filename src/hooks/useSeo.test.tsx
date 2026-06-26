import { render, act } from '@testing-library/react'
import { useSeo } from '../useSeo'

function TestComponent({ title, description }: { title: string; description?: string }) {
  useSeo({ title, description })
  return <div>test</div>
}

describe('useSeo', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = 'Original Title'
  })

  it('sets document title with brand suffix', () => {
    render(<TestComponent title="Bond" />)
    expect(document.title).toBe('Bond · Credence')
  })

  it('sets meta description when provided', () => {
    render(<TestComponent title="Bond" description="Create bonds on Stellar" />)
    const meta = document.querySelector('meta[name="description"]')
    expect(meta?.getAttribute('content')).toBe('Create bonds on Stellar')
  })

  it('sets og:title meta tag', () => {
    render(<TestComponent title="Dashboard" />)
    const ogTitle = document.querySelector('meta[property="og:title"]')
    expect(ogTitle?.getAttribute('content')).toBe('Dashboard · Credence')
  })

  it('sets og:description meta tag when description provided', () => {
    render(<TestComponent title="Home" description="Welcome to Credence" />)
    const ogDesc = document.querySelector('meta[property="og:description"]')
    expect(ogDesc?.getAttribute('content')).toBe('Welcome to Credence')
  })

  it('does not set meta description when not provided', () => {
    render(<TestComponent title="Home" />)
    const meta = document.querySelector('meta[name="description"]')
    expect(meta).toBeNull()
  })

  it('restores previous title on unmount', () => {
    const { unmount } = render(<TestComponent title="Bond" />)
    expect(document.title).toBe('Bond · Credence')
    unmount()
    expect(document.title).toBe('Original Title')
  })

  it('updates title when prop changes', () => {
    const { rerender } = render(<TestComponent title="Bond" />)
    expect(document.title).toBe('Bond · Credence')
    rerender(<TestComponent title="Dashboard" />)
    expect(document.title).toBe('Dashboard · Credence')
  })
})

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './NotFound'
import { NOT_FOUND_LINKS } from '../config/navigation'

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<object>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('NotFound Page', () => {
  afterEach(() => vi.clearAllMocks())
  it('renders all crucial 404 page content', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )

    // Main heading
    expect(screen.getByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument()

    // 404 code text
    expect(screen.getByText(/error/i, { selector: 'p' })).toHaveTextContent(/error\s*404/i)

    // Description text
    expect(screen.getByText(/the page you're looking for doesn't exist/i)).toBeInTheDocument()

    // Recovery Action buttons
    expect(screen.getByRole('button', { name: 'Back to Home', exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()

    // Quick links section heading
    expect(screen.getByRole('heading', { level: 2, name: /quick navigation/i })).toBeInTheDocument()

    // Quick links targets
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /^bond$/i })).toHaveAttribute('href', '/bond')
    expect(screen.getByRole('link', { name: /^trust score$/i })).toHaveAttribute('href', '/trust')
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
  })

  it('triggers navigate on button clicks', () => {
    mockNavigate.mockClear()
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )

    // Click Back to Home
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home', exact: true }))
    expect(mockNavigate).toHaveBeenCalledWith('/')

    // Click Go Back
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
  it('renders exactly the quick links selected by the shared config', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('link')).toHaveLength(NOT_FOUND_LINKS.length)
    for (const { to, label } of NOT_FOUND_LINKS) {
      expect(within(list).getByRole('link', { name: label })).toHaveAttribute('href', to)
    }
  })

  it.each([
    ['/dashbord', 'Dashboard', '/dashboard'],
    ['/transactons', 'Transactions', '/transactions'],
    ['/attestaton', 'Attestations', '/attestations'],
  ])('suggests the real shared destination for %s', (path, label, to) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <NotFound />
      </MemoryRouter>
    )
    const suggestion = screen.getByText(/did you mean/i)
    expect(within(suggestion).getByRole('link', { name: label })).toHaveAttribute('href', to)
  })

  it.each(['/unrelated-long-path-xyz', '/dashboard'])('does not suggest a route for %s', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <NotFound />
      </MemoryRouter>
    )
    expect(screen.queryByText(/did you mean/i)).not.toBeInTheDocument()
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './NotFound'

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
  it('renders all crucial 404 page content', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )

    // Main heading
    expect(screen.getByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument()

    // 404 code text
    expect(screen.getByText(/error 404/i)).toBeInTheDocument()

    // Description text
    expect(screen.getByText(/we couldn't find the page you are looking for/i)).toBeInTheDocument()

    // Recovery Action buttons
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()

    // Quick links section heading
    expect(screen.getByRole('heading', { level: 2, name: /quick navigation/i })).toBeInTheDocument()

    // Quick links targets
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /bond management/i })).toHaveAttribute('href', '/bond')
    expect(screen.getByRole('link', { name: /trust score lookup/i })).toHaveAttribute(
      'href',
      '/trust'
    )
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
    fireEvent.click(screen.getByRole('button', { name: /back to home/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')

    // Click Go Back
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})

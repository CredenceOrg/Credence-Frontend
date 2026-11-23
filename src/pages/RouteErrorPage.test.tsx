import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RouteErrorPage from './RouteErrorPage'

function renderWithRouterError(loader: () => unknown) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        loader,
        element: <div>Home</div>,
        errorElement: <RouteErrorPage />,
      },
    ],
    { initialEntries: ['/'] }
  )

  return render(<RouterProvider router={router} />)
}

describe('RouteErrorPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders generic router error state for thrown Error objects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithRouterError(() => {
      throw new Error('Loader failure')
    })

    expect(
      await screen.findByText('An unexpected router error occurred. Try again in a moment.')
    ).toBeInTheDocument()
    expect(screen.getByRole('alert', { name: 'Router error' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to home page' })).toHaveAttribute('href', '/')
  })

  it('renders generic router error state for non-Error throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithRouterError(() => {
      throw 'unexpected string failure'
    })

    expect(
      await screen.findByText('An unexpected router error occurred. Try again in a moment.')
    ).toBeInTheDocument()
    expect(screen.getByRole('alert', { name: 'Router error' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
  })

  it('renders generic router error state for non-404 Response errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithRouterError(() => {
      throw new Response('Internal Server Error', { status: 500, statusText: 'Server Error' })
    })

    expect(
      await screen.findByText('An unexpected router error occurred. Try again in a moment.')
    ).toBeInTheDocument()
    expect(screen.getByRole('alert', { name: 'Router error' })).toBeInTheDocument()
  })

  it('renders page-not-found state for 404 route error responses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderWithRouterError(() => {
      throw new Response('Not Found', { status: 404, statusText: 'Not Found' })
    })

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'The page you were looking for could not be found. It may have moved or been renamed.'
      )
    ).toBeInTheDocument()
    const alert = screen.getByRole('alert', { name: 'Route not found' })
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveAttribute('data-error-kind', 'pageNotFound')
    expect(alert).toHaveAttribute('data-error-severity', 'info')
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to home page' })).toHaveAttribute('href', '/')
  })

  it('navigates home when the Go home recovery action is clicked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    const originalLocation = window.location
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        get href() {
          return originalLocation.href
        },
        set href(url: string) {
          hrefSetter(url)
        },
      },
    })

    try {
      renderWithRouterError(() => {
        throw new Error('Route crash')
      })

      const goHomeButton = await screen.findByRole('button', { name: 'Go home' })
      await user.click(goHomeButton)

      expect(hrefSetter).toHaveBeenCalledWith('/')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})

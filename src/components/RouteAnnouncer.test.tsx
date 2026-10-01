import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import RouteAnnouncer, {
  ANNOUNCEMENT_DELAY_MS,
  ROUTE_LABELS,
  resolveRouteLabel,
} from './RouteAnnouncer'

describe('RouteAnnouncer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is visually hidden but correctly structured in the DOM tree on mount', () => {
    render(
      <MemoryRouter initialEntries={'/dashboard'}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    const announcerRegion = document.querySelector('.sr-only') as HTMLElement
    expect(announcerRegion).toHaveAttribute('aria-live', 'polite')
    expect(announcerRegion).toHaveAttribute('aria-atomic', 'true')
  })

  it('defers the announcement text setup until after layout paint', () => {
    render(
      <MemoryRouter initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    const announcer = document.querySelector('.sr-only') as HTMLElement
    expect(announcer.textContent).toBe('')

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(announcer.textContent).toBe('Bond page loaded')
  })

  it('updates text dynamically on active route modifications', () => {
    const { rerender } = render(
      <MemoryRouter key="dashboard" initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.getByText('Dashboard page loaded')).toBeInTheDocument()

    rerender(
      <MemoryRouter key="/trust" initialEntries={'/trust'}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.getByText('Trust Score page loaded')).toBeInTheDocument()
  })

  it('falls back gracefully to structural 404 descriptions given unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/some/unknown/route']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.getByText('Page Not Found loaded')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // Boundary + recovery coverage (added for this issue)
  // --------------------------------------------------------------------------

  describe('resolveRouteLabel (boundary invariants)', () => {
    it('returns the mapped label for every registered route', () => {
      for (const [path, label] of Object.entries(ROUTE_LABELS)) {
        expect(resolveRouteLabel(path)).toBe(label)
      }
    })

    it('normalizes duplicate and trailing slashes deterministically', () => {
      expect(resolveRouteLabel('//dashboard/')).toBe('Dashboard page')
      expect(resolveRouteLabel('/dashboard/')).toBe('Dashboard page')
      expect(resolveRouteLabel('///')).toBe('Home page')
    })

    it('falls back to Page Not Found for unknown, malformed, or non-string inputs', () => {
      expect(resolveRouteLabel('/not-a-route')).toBe('Page Not Found')
      expect(resolveRouteLabel('')).toBe('Page Not Found')
      expect(resolveRouteLabel(undefined)).toBe('Page Not Found')
      expect(resolveRouteLabel(null)).toBe('Page Not Found')
      expect(resolveRouteLabel(42)).toBe('Page Not Found')
    })

    it('is pure and deterministic across repeated calls', () => {
      const a = resolveRouteLabel('/bond')
      const b = resolveRouteLabel('/bond')
      expect(a).to%Be(b)
      expect(a).toBe('Bond page')
    })
  })

  it('clears the live region immediately on route change to avoid stale text', () => {
    const { rerender } = render(
      <MemoryRouter key="dashboard" initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.getByText('Dashboard page loaded')).toBeInTheDocument()

    rerender(
      <MemoryRouter key="/trust" initialEntries={['/trust']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    // Before the deferred timer fires, the old announcement must be gone.
    const announcer = document.querySelector('.sr-only') as HTMLElement
    expect(announcer.textContent).toBe('')

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.getByText('Trust Score page loaded')).toBeInTheDocument()
  })

  it('cancels a pending announcement when the route changes before the delay elapses', () => {
    const { rerender } = render(
      <MemoryRouter key="dashboard" initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    // Advance partially -- the deferred timer has not yet fired.
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS - 1)
    })

    rerender(
      <MemoryRouter key="/bond" initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    // Flush the old timer window. The stale 'Dashboard' announcement must not
    // appear.
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.queryByText('Dashboard page loaded')).not.toBeInTheDocument()
    expect(screen.getByText('Bond page loaded')).toBeInTheDocument()
  })

  it('re-announces the same label on a repeat visit to the same route', () => {
    const { rerender } = render(
      <MemoryRouter key="dashboard" initialEntries={'/dashboard'}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.getByText('Dashboard page loaded')).toBeInTheDocument()

    // Navigate away and back to the same route.
    rerender(
      <MemoryRouter key="/trust" initialEntries={'/trust'}>
        <RouteAnnouncer />
      </MemoryRouter>
    )
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })

    rerender(
      <MemoryRouter key="dashboard-2" initialEntries={'/dashboard'}>
        <RouteAnnouncer />
      </MemoryRouter>
    )
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })
    expect(screen.getByText('Dashboard page loaded')).toBeInTheDocument()
  })

  it('clears the pending timer on unmount withount leaking a state update', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    unmount()

    // Flushing timers after unmount must not throw or warn.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
      })
    }).not.toThrow()
  })

  it('recovers from a rapid A -> B -> A navigation without losing the final announcement', () => {
    const { rerender } = render(
      <MemoryRouter key="a" initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    // A -> B before the delay fires.
    rerender(
      <MemoryRouter key="b" initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    // B -> A before the delay fires.
    rerender(
      <MemoryRouter key="a2" initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })

    expect(screen.getByText('Dashboard page loaded')).toBeInTheDocument()
    expect(screen.queryByText('Bond page loaded')).not.toBeInTheDocument()
  })

  it('survives a navigation triggered from within an effect without losing the final announcement', () => {
    function AutoNavigator({ to }: { to: string }) {
      const navigate = useNavigate()
      useEffect(() => {
        navigate(to)
      }, [navigate, to])
      return null
    }

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
        <AutoNavigator to="/trust" />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_DELAY_MS)
    })

    expect(screen.getByText('Trust Score page loaded')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard page loaded')).not.toBeInTheDocument()
  })

  it('renders an empty live region for an unmapped route without throwing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/not-registered']}>
          <RouteAnnouncer />
        </MemoryRouter>
      )
    }).not.toThrow()

    const announcer = document.querySelector('.sr-only') as HTMLElement
    expect(announcer).toBeInTheDocument()
    expect(announcer.textContent).toBe('')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RouteAnnouncer from './RouteAnnouncer'

function getAnnouncer() {
  return document.querySelector('[aria-live="polite"]') as HTMLElement
}

function NavigateTo({ to }: { to: string }) {
  const navigate = useNavigate()
  useEffect(() => { navigate(to) }, [navigate, to])
  return null
}

// Helper component to trigger dynamic route transitions in tests
function TestNavigator({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [to, navigate]);
  return null;
}

describe('RouteAnnouncer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is visually hidden but correctly structured in the DOM tree on mount', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    const announcerRegion = document.querySelector('.sr-only') as HTMLElement
    expect(announcerRegion).toHaveAttribute('aria-live', 'polite');
    expect(announcerRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('defers the announcement text setup until after layout paint', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    const announcer = document.querySelector('.sr-only') as HTMLElement
    expect(announcer.textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(announcer.textContent).toBe('Bond page loaded')
  })

  it('updates text dynamically on active route modifications', () => {
    const { rerender } = render(
      <MemoryRouter key="dashboard" initialEntries={['/dashboard']}>
        <RouteAnnouncer />
        <NavigateTo to="/trust" />
      </MemoryRouter>
    )

    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText('Dashboard page loaded')).toBeInTheDocument();

    // A distinct key remounts the router at the new entry; MemoryRouter only reads
    // initialEntries on mount, so without this the location would not change.
    rerender(
      <MemoryRouter key="/trust" initialEntries={['/trust']}>
        <RouteAnnouncer />
        <TestNavigator to="/trust" />
      </MemoryRouter>
    )

    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText('Trust Score page loaded')).toBeInTheDocument();
  });

  it('falls back gracefully to structural 404 descriptions given unknown routes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/some/unknown/route']}>
        <RouteAnnouncer />
      </MemoryRouter>
    )

    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText('Page Not Found loaded')).toBeInTheDocument();
  });
});

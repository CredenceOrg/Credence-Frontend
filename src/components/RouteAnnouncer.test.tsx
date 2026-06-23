import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import RouteAnnouncer from './RouteAnnouncer';

function getAnnouncer() {
  return document.querySelector('[aria-live="polite"]') as HTMLElement
}

function NavigateTo({ to }: { to: string }) {
  const navigate = useNavigate()
  useEffect(() => { navigate(to) }, [navigate, to])
  return null
}

describe('RouteAnnouncer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is visually hidden but correctly structured in the DOM tree on mount', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    const announcerRegion = getAnnouncer();
    expect(announcerRegion).toHaveAttribute('aria-live', 'polite');
    expect(announcerRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('defers the announcement text setup until after layout paint', () => {
    render(
      <MemoryRouter initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    const announcer = getAnnouncer();
    expect(announcer.textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(announcer.textContent).toBe('Bond page loaded');
  });

  it('updates text dynamically on active route modifications', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
        <NavigateTo to="/trust" />
      </MemoryRouter>
    );

    // NavigateTo fires navigate() in useEffect; advance timers to let both
    // the navigation effect and the announcer's debounce timeout run
    act(() => { vi.advanceTimersByTime(200); });
    expect(getAnnouncer().textContent).toBe('Trust Score page loaded');
  });

  it('falls back gracefully to structural 404 descriptions given unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/some/unknown/route']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    act(() => { vi.advanceTimersByTime(100); });
    expect(getAnnouncer().textContent).toBe('Page Not Found loaded');
  });
});
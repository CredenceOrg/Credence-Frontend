import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RouteAnnouncer from './RouteAnnouncer';

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

    const announcerRegion = screen.getByRole('none', { hidden: true });
    expect(announcerRegion).toHaveAttribute('aria-live', 'polite');
    expect(announcerRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('defers the announcement text setup until after layout paint', () => {
    render(
      <MemoryRouter initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    const announcer = screen.getByRole('none', { hidden: true });
    expect(announcer.textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(announcer.textContent).toBe('Bond page loaded');
  });

  it('updates text dynamically on active route modifications', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByRole('none', { hidden: true }).textContent).toBe('Dashboard page loaded');

    rerender(
      <MemoryRouter initialEntries={['/trust']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByRole('none', { hidden: true }).textContent).toBe('Trust Score page loaded');
  });

  it('falls back gracefully to structural 404 descriptions given unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/some/unknown/route']}>
        <RouteAnnouncer />
      </MemoryRouter>
    );

    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByRole('none', { hidden: true }).textContent).toBe('Page Not Found loaded');
  });
});
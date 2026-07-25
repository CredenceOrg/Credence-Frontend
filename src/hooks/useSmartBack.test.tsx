import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useSmartBack } from './useSmartBack'

function TestComponent({ fallback }: { fallback?: string }) {
  const { goBack, fallback: activeFallback } = useSmartBack({ fallback })
  const location = useLocation()

  return (
    <div>
      <span data-testid="current-location">{location.pathname}</span>
      <span data-testid="active-fallback">{activeFallback}</span>
      <button onClick={goBack}>Back</button>
    </div>
  )
}

function renderSmartBackApp(initialEntries: (string | { pathname: string; state?: unknown })[], fallback?: string) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/trust" element={<div>Trust Score Page</div>} />
        <Route path="/settings" element={<div>Settings Page</div>} />
        <Route path="/detail" element={<TestComponent fallback={fallback} />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('useSmartBack hook', () => {
  it('honours_prior_route_path_when_from_state_is_present', async () => {
    renderSmartBackApp([
      { pathname: '/detail', state: { from: '/trust' } },
    ])

    expect(screen.getByTestId('current-location')).toHaveTextContent('/detail')

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(await screen.findByText('Trust Score Page')).toBeInTheDocument()
  })

  it('falls_back_to_dashboard_when_history_is_missing', async () => {
    renderSmartBackApp(['/detail'])

    expect(screen.getByTestId('current-location')).toHaveTextContent('/detail')
    expect(screen.getByTestId('active-fallback')).toHaveTextContent('/dashboard')

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument()
  })

  it('uses_custom_fallback_path_when_specified', async () => {
    renderSmartBackApp(['/detail'], '/settings')

    expect(screen.getByTestId('active-fallback')).toHaveTextContent('/settings')

    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(await screen.findByText('Settings Page')).toBeInTheDocument()
  })
})

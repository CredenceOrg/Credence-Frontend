import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FeatureFlagProvider } from '../../context/FeatureFlagContext'
import DebugOverlay from './DebugOverlay'

function renderOverlay(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <FeatureFlagProvider>
        <DebugOverlay />
      </FeatureFlagProvider>
    </MemoryRouter>
  )
}

function NavigateControls() {
  const navigate = useNavigate()

  return (
    <>
      <button onClick={() => navigate('/?debug=1&newDashboard=1')}>enable new dashboard</button>
      <button onClick={() => navigate('/?debug=1')}>disable new dashboard</button>
    </>
  )
}

describe('DebugOverlay', () => {
  it('renders nothing when debug mode is off', () => {
    const { container } = renderOverlay()
    expect(container.innerHTML).toBe('')
  })

  it('renders the toggle button when debug mode is on', () => {
    renderOverlay('?debug=1')
    expect(screen.getByRole('button', { name: /open debug overlay/i })).toBeInTheDocument()
  })

  it('opens the panel when the toggle button is clicked', () => {
    renderOverlay('?debug=1')

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))

    expect(screen.getByRole('dialog', { name: /feature flags debug overlay/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close debug toggle/i })).toBeInTheDocument()
  })

  it('closes the panel when the close button is clicked', () => {
    renderOverlay('?debug=1')

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close debug overlay' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows ON badge for active flags', () => {
    renderOverlay('?debug=1&newDashboard=1&newTransactionList=1')

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))

    expect(screen.getByTestId('flag-debug')).toHaveTextContent('ON')
    expect(screen.getByTestId('flag-newDashboard')).toHaveTextContent('ON')
    expect(screen.getByTestId('flag-betaChart')).toHaveTextContent('OFF')
    expect(screen.getByTestId('flag-newTransactionList')).toHaveTextContent('ON')
  })

  it('shows all flags OFF when none are active', () => {
    renderOverlay('?debug=1')

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))

    expect(screen.getByTestId('flag-debug')).toHaveTextContent('ON')
    expect(screen.getByTestId('flag-newDashboard')).toHaveTextContent('OFF')
    expect(screen.getByTestId('flag-betaChart')).toHaveTextContent('OFF')
    expect(screen.getByTestId('flag-newTransactionList')).toHaveTextContent('OFF')
  })

  it('shows the hint text about URL params', () => {
    renderOverlay('?debug=1')

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))

    expect(screen.getByText(/set flags via url/i)).toBeInTheDocument()
  })

  it('updates flag badges after client-side navigation', () => {
    render(
      <MemoryRouter initialEntries={['/?debug=1']}>
        <FeatureFlagProvider>
          <DebugOverlay />
          <NavigateControls />
        </FeatureFlagProvider>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))
    expect(screen.getByTestId('flag-newDashboard')).toHaveTextContent('OFF')

    fireEvent.click(screen.getByRole('button', { name: 'enable new dashboard' }))
    expect(screen.getByTestId('flag-newDashboard')).toHaveTextContent('ON')

    fireEvent.click(screen.getByRole('button', { name: 'disable new dashboard' }))
    expect(screen.getByTestId('flag-newDashboard')).toHaveTextContent('OFF')
  })
})

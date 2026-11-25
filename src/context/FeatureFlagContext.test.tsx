import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { FeatureFlags } from '../config/featureFlags'
import { FeatureFlagProvider, useFeatureFlag, useFeatureFlags } from './FeatureFlagContext'

function FlagProbe() {
  const debug = useFeatureFlag('debug')
  const newDashboard = useFeatureFlag('newDashboard')

  return (
    <>
      <span data-testid="debug">{String(debug)}</span>
      <span data-testid="newDashboard">{String(newDashboard)}</span>
    </>
  )
}

function FlagsProbe({ snapshots }: { snapshots: FeatureFlags[] }) {
  const flags = useFeatureFlags()
  snapshots.push(flags)
  return <span data-testid="flags">{JSON.stringify(flags)}</span>
}

function NavigateControls() {
  const navigate = useNavigate()

  return (
    <>
      <button onClick={() => navigate('/dashboard?newDashboard=1')}>enable flag</button>
      <button onClick={() => navigate('/dashboard')}>disable flag</button>
    </>
  )
}

describe('FeatureFlagProvider', () => {
  it('returns default flags when the location has no flag params', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <FeatureFlagProvider>
          <FlagProbe />
        </FeatureFlagProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('debug')).toHaveTextContent('false')
    expect(screen.getByTestId('newDashboard')).toHaveTextContent('false')
  })

  it('reads flags from the current location search string', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?debug=1&newDashboard=true']}>
        <FeatureFlagProvider>
          <FlagProbe />
        </FeatureFlagProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('debug')).toHaveTextContent('true')
    expect(screen.getByTestId('newDashboard')).toHaveTextContent('true')
  })

  it('updates flags on client-side navigation', () => {
    const snapshots: FeatureFlags[] = []

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <FeatureFlagProvider>
          <FlagProbe />
          <FlagsProbe snapshots={snapshots} />
          <NavigateControls />
        </FeatureFlagProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('newDashboard')).toHaveTextContent('false')

    fireEvent.click(screen.getByRole('button', { name: 'enable flag' }))
    expect(screen.getByTestId('newDashboard')).toHaveTextContent('true')
    expect(screen.getByTestId('debug')).toHaveTextContent('true')
    expect(snapshots[snapshots.length - 1]).not.toBe(snapshots[0])

    fireEvent.click(screen.getByRole('button', { name: 'disable flag' }))
    expect(screen.getByTestId('newDashboard')).toHaveTextContent('false')
    expect(screen.getByTestId('debug')).toHaveTextContent('false')
  })

  it('memoises flags while the search string is unchanged', () => {
    const snapshots: FeatureFlags[] = []

    function Tree({ label }: { label: string }) {
      return (
        <MemoryRouter initialEntries={['/dashboard?betaChart=1']}>
          <FeatureFlagProvider>
            <FlagsProbe snapshots={snapshots} />
            <span>{label}</span>
          </FeatureFlagProvider>
        </MemoryRouter>
      )
    }

    const { rerender } = render(<Tree label="first" />)
    rerender(<Tree label="second" />)

    expect(snapshots).toHaveLength(2)
    expect(snapshots[1]).toBe(snapshots[0])
    expect(snapshots[0].betaChart).toBe(true)
  })
})

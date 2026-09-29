import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import BreakpointOverlay from './BreakpointOverlay'
import { LOCAL_STORAGE_KEYS } from '../../config/constants'

describe('BreakpointOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the overlay by default in dev mode', () => {
    render(<BreakpointOverlay />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hide breakpoints/i })).toBeInTheDocument()
  })

  it('toggles visibility and saves to localStorage', () => {
    render(<BreakpointOverlay />)

    // Default is visible
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /hide breakpoints/i })
    fireEvent.click(closeBtn)

    // Now the toggle button should be visible
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show breakpoints/i })).toBeInTheDocument()
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.DEV_BREAKPOINTS)).toBe('false')

    // Click toggle button to show again
    const showBtn = screen.getByRole('button', { name: /show breakpoints/i })
    fireEvent.click(showBtn)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.DEV_BREAKPOINTS)).toBe('true')
  })

  it('respects initial localStorage value', () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.DEV_BREAKPOINTS, 'false')
    render(<BreakpointOverlay />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show breakpoints/i })).toBeInTheDocument()
  })
})

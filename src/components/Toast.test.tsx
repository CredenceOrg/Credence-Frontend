import { render, screen, act, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Toast from './Toast'

describe('Toast Component - Pause on Hover/Focus', () => {
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    mockOnDismiss.mockClear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('auto-dismisses after the specified duration', () => {
    render(<Toast toast={{ id: '1', severity: 'info', message: 'Test', durationMs: 5000 }} onDismiss={mockOnDismiss} />)
    
    expect(mockOnDismiss).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(mockOnDismiss).not.toHaveBeenCalled()
    
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(mockOnDismiss).toHaveBeenCalledWith('1')
  })

  it('pauses timer on mouse hover and resumes on leave from remaining time', () => {
    render(<Toast toast={{ id: '2', severity: 'success', message: 'Hover me', durationMs: 5000 }} onDismiss={mockOnDismiss} />)
    
    // Advance 2000ms, leaving 3000ms
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const toastElement = screen.getByRole('status')
    
    // Mouse enter pauses the timer
    fireEvent.mouseEnter(toastElement)
    
    // Advance 5000ms while hovered - should NOT dismiss
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(mockOnDismiss).not.toHaveBeenCalled()

    // Mouse leave resumes the timer from where it left off (3000ms)
    fireEvent.mouseLeave(toastElement)
    
    // Advance 2999ms - should NOT dismiss yet
    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(mockOnDismiss).not.toHaveBeenCalled()

    // Advance final 1ms
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(mockOnDismiss).toHaveBeenCalledWith('2')
  })

  it('pauses timer on focus and resumes on blur', () => {
    render(<Toast toast={{ id: '3', severity: 'warning', message: 'Focus me', durationMs: 3000 }} onDismiss={mockOnDismiss} />)
    
    // Advance 1000ms, leaving 2000ms
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const toastElement = screen.getByRole('status')
    
    // Focus pauses the timer
    fireEvent.focus(toastElement)
    
    // Advance 3000ms while focused - should NOT dismiss
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(mockOnDismiss).not.toHaveBeenCalled()

    // Blur resumes it
    fireEvent.blur(toastElement)
    
    // Advance 2000ms
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(mockOnDismiss).toHaveBeenCalledWith('3')
  })

  it('maintains paused state if both hovered and focused', () => {
    render(<Toast toast={{ id: '4', severity: 'info', message: 'Both', durationMs: 4000 }} onDismiss={mockOnDismiss} />)
    const toastElement = screen.getByRole('status')

    fireEvent.mouseEnter(toastElement)
    fireEvent.focus(toastElement)

    // Unhover, but keep focus
    fireEvent.mouseLeave(toastElement)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    // Should still be paused because focus remains
    expect(mockOnDismiss).not.toHaveBeenCalled()
    
    // Remove focus, timer resumes
    fireEvent.blur(toastElement)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(mockOnDismiss).toHaveBeenCalledWith('4')
  })

  it('respects sticky behavior for 0 duration (e.g. danger or autoDismiss: off)', () => {
    render(<Toast toast={{ id: '5', severity: 'danger', message: 'Sticky', durationMs: 0 }} onDismiss={mockOnDismiss} />)
    const toastElement = screen.getByRole('status')

    // Ensure hovering doesn't crash or trigger resume logic incorrectly.
    fireEvent.mouseEnter(toastElement)
    fireEvent.mouseLeave(toastElement)

    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(mockOnDismiss).not.toHaveBeenCalled()
  })

  it('clears timer on component unmount to prevent leaks', () => {
    const { unmount } = render(<Toast toast={{ id: '6', severity: 'info', message: 'Unmount', durationMs: 5000 }} onDismiss={mockOnDismiss} />)
    
    unmount()

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    // Cannot be called because component is gone and timer is cleared
    expect(mockOnDismiss).not.toHaveBeenCalled()
  })
})

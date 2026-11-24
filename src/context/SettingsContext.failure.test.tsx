import { renderHook, act, render, screen } from '@testing-library/react'
import React from 'react'
import { SettingsProvider, useSettings, SettingsErrorBoundary } from './SettingsContext'
import { safeStorage } from '../hooks/useLocalStorage'

const STORAGE_KEY = 'credence:settings'

describe('SettingsContext Failure Boundary', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  it('normal load/save flow', () => {
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider })
    expect(result.current.canPersist).toBe(true)
    expect(result.current.lastError).toBeNull()

    act(() => {
      result.current.setThemeMode('dark')
    })
    
    act(() => {
      result.current.saveSettings()
    })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.themeMode).toBe('dark')
    expect(result.current.canPersist).toBe(true)
  })

  it('corrupted JSON in storage -> fallback to defaults, lastError set', () => {
    localStorage.setItem(STORAGE_KEY, '{ invalid json')
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider })
    
    expect(result.current.themeMode).toBe('system') // default
    expect(result.current.lastError).toBeTruthy()
  })

  it('write quota error -> canPersist false, lastError set, retryPersist succeeds after quota cleared', async () => {
    const mockSetItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider })
    
    act(() => {
      result.current.setThemeMode('dark')
    })
    
    act(() => {
      result.current.saveSettings()
    })

    expect(result.current.canPersist).toBe(false)
    expect(result.current.lastError?.message).toBe('QuotaExceededError')

    mockSetItem.mockRestore()

    await act(async () => {
      await result.current.retryPersist()
    })

    expect(result.current.canPersist).toBe(true)
    expect(result.current.lastError).toBeNull()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.themeMode).toBe('dark')
  })

  it('SettingsErrorBoundary displays fallback UI on error', () => {
    localStorage.setItem(STORAGE_KEY, '{ invalid }')

    const TestComponent = () => {
      return <div>Normal UI</div>
    }

    render(
      <SettingsProvider>
        <SettingsErrorBoundary>
          <TestComponent />
        </SettingsErrorBoundary>
      </SettingsProvider>
    )

    expect(screen.getByText('Settings could not be saved.')).toBeInTheDocument()
    expect(screen.queryByText('Normal UI')).not.toBeInTheDocument()
  })
})

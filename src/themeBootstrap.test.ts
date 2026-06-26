import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeEach, vi } from 'vitest'

function runBootstrap() {
  const html = readFileSync('index.html', 'utf8')
  const script = html.match(/<script id="theme-preference-bootstrap">([\s\S]*?)<\/script>/)?.[1]

  if (!script) {
    throw new Error('theme-preference-bootstrap script not found')
  }
  Function(script)()
}

function mockSystemTheme(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: prefersDark,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('theme preference bootstrap', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    mockSystemTheme(false)
  })

  it('applies a persisted explicit dark theme before React renders', () => {
    localStorage.setItem('credence:settings', JSON.stringify({ themeMode: 'dark' }))

    runBootstrap()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('resolves a persisted system theme from matchMedia', () => {
    mockSystemTheme(true)
    localStorage.setItem('credence:settings', JSON.stringify({ themeMode: 'system' }))

    runBootstrap()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('uses the legacy theme key only when the settings payload is absent', () => {
    localStorage.setItem('theme', 'light')

    runBootstrap()

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('falls back to the system preference when stored settings are corrupt', () => {
    mockSystemTheme(true)
    localStorage.setItem('credence:settings', 'not-json')

    runBootstrap()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'
import Attestations from './Attestations'
import SignIn from './SignIn'
import Settings from './Settings'

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    connect: vi.fn(),
    isConnecting: false,
    connected: false,
    address: null,
  }),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      themeMode: 'light',
      network: 'public',
      addressDisplay: 'short',
      notifications: { email: false, push: false },
    },
    updateSettings: vi.fn(),
  }),
}))

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../components/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

vi.mock('../components/AttestationForm', () => ({
  default: () => <div data-testid="attestation-form" />,
}))

describe('Page document.title accessibility (WCAG 2.4.2 Page Titled)', () => {
  const genericIndexTitle = 'Credence — Economic Trust'

  beforeEach(() => {
    document.title = genericIndexTitle
  })

  afterEach(() => {
    cleanup()
    document.title = genericIndexTitle
  })

  it('sets non-empty, pairwise distinct titles for /, /attestations, and /signin that differ from /settings', () => {
    // 1. Home (/)
    const { unmount: unmountHome } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    const homeTitle = document.title
    unmountHome()

    // 2. Attestations (/attestations)
    const { unmount: unmountAttestations } = render(
      <MemoryRouter>
        <Attestations />
      </MemoryRouter>
    )
    const attestationsTitle = document.title
    unmountAttestations()

    // 3. SignIn (/signin)
    const { unmount: unmountSignIn } = render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    )
    const signInTitle = document.title
    unmountSignIn()

    // 4. Settings (/settings)
    const { unmount: unmountSettings } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const settingsTitle = document.title
    unmountSettings()

    // All titles must be non-empty strings
    expect(homeTitle).toBeTruthy()
    expect(attestationsTitle).toBeTruthy()
    expect(signInTitle).toBeTruthy()
    expect(settingsTitle).toBeTruthy()

    // Titles must be different from the unbranded generic index.html title
    expect(homeTitle).not.toBe(genericIndexTitle)
    expect(attestationsTitle).not.toBe(genericIndexTitle)
    expect(signInTitle).not.toBe(genericIndexTitle)
    expect(settingsTitle).not.toBe(genericIndexTitle)

    // document.title for /, /attestations, and /signin must be different from the title of /settings
    expect(homeTitle).not.toBe(settingsTitle)
    expect(attestationsTitle).not.toBe(settingsTitle)
    expect(signInTitle).not.toBe(settingsTitle)

    // document.title for /, /attestations, and /signin must be pairwise distinct
    expect(homeTitle).not.toBe(attestationsTitle)
    expect(homeTitle).not.toBe(signInTitle)
    expect(attestationsTitle).not.toBe(signInTitle)

    // As a set, all four must be unique
    const uniqueTitles = new Set([homeTitle, attestationsTitle, signInTitle, settingsTitle])
    expect(uniqueTitles.size).toBe(4)
  })
})

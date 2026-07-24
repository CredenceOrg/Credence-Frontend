import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function renderAppAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

function createBeforeInstallPromptEvent() {
  const event = new Event('beforeinstallprompt') as Event & {
    preventDefault: () => void
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  event.preventDefault = vi.fn()
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'dismissed' })

  return event
}

describe('App routing', () => {
  it('renders the Settings page at /settings', async () => {
    renderAppAt('/settings')

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /page not found/i })).not.toBeInTheDocument()
  })

  it('keeps unknown routes wired to NotFound', async () => {
    renderAppAt('/missing-route')

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('renders the CreateBondFlow wizard at /bond/new', async () => {
    renderAppAt('/bond/new')

    expect(await screen.findByRole('heading', { name: /^Create Bond$/i })).toBeInTheDocument()
    expect(await screen.findByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('shows the install prompt card once per session and respects dismissal', async () => {
    renderAppAt('/')

    expect(await screen.findByRole('link', { name: /credence/i })).toBeInTheDocument()

    window.dispatchEvent(createBeforeInstallPromptEvent())
    window.dispatchEvent(createBeforeInstallPromptEvent())

    expect(await screen.findByText(/Install Credence/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Install Credence/i)).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

    expect(screen.queryByText(/Install Credence/i)).not.toBeInTheDocument()

    window.dispatchEvent(createBeforeInstallPromptEvent())

    expect(screen.queryByText(/Install Credence/i)).not.toBeInTheDocument()
  })
})

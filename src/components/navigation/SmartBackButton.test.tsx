import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SmartBackButton from './SmartBackButton'

function renderSmartBackNavigation(
  initialEntries: (string | { pathname: string; state?: unknown })[],
  buttonProps: Partial<React.ComponentProps<typeof SmartBackButton>> = {}
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
        <Route path="/trust" element={<div>Trust Score Destination</div>} />
        <Route path="/settings" element={<div>Settings Destination</div>} />
        <Route path="/test-page" element={<SmartBackButton {...buttonProps} />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SmartBackButton', () => {
  it('renders_button_with_default_label', () => {
    renderSmartBackNavigation(['/test-page'])

    const button = screen.getByRole('button', { name: /go back/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('credence-smart-back-button')
  })

  it('renders_button_with_custom_label_and_custom_class_name', () => {
    renderSmartBackNavigation(['/test-page'], {
      label: 'Return Previous',
      className: 'custom-class',
    })

    const button = screen.getByRole('button', { name: /return previous/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('custom-class')
  })

  it('navigates_to_prior_route_path_when_from_state_is_present', async () => {
    renderSmartBackNavigation([{ pathname: '/test-page', state: { from: '/trust' } }])

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(await screen.findByText('Trust Score Destination')).toBeInTheDocument()
  })

  it('falls_back_to_dashboard_when_no_prior_history_or_state_exists', async () => {
    renderSmartBackNavigation(['/test-page'])

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(await screen.findByText('Dashboard Destination')).toBeInTheDocument()
  })

  it('falls_back_to_custom_fallback_when_specified_and_history_is_missing', async () => {
    renderSmartBackNavigation(['/test-page'], { fallback: '/settings' })

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(await screen.findByText('Settings Destination')).toBeInTheDocument()
  })

  it('invokes_custom_onClick_prop_when_clicked', () => {
    const handleCustomClick = vi.fn()
    renderSmartBackNavigation(['/test-page'], { onClick: handleCustomClick })

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(handleCustomClick).toHaveBeenCalledTimes(1)
  })
})

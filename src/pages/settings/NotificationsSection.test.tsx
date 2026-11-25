// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsSection from './NotificationsSection'

describe('NotificationsSection', () => {
  it('renders notification controls and quiet hours fields', async () => {
    const user = userEvent.setup()
    const onPreviewToast = vi.fn()
    const onToastsEnabledChange = vi.fn()

    render(
      <NotificationsSection
        toastsEnabled={true}
        autoDismiss="5s"
        quietHoursEnabled={false}
        quietHoursStart="22:00"
        quietHoursEnd="07:00"
        onToastsEnabledChange={onToastsEnabledChange}
        onAutoDismissChange={vi.fn()}
        onQuietHoursEnabledChange={vi.fn()}
        onQuietHoursStartChange={vi.fn()}
        onQuietHoursEndChange={vi.fn()}
        onPreviewToast={onPreviewToast}
      />
    )

    expect(screen.getByRole('heading', { level: 2, name: /notifications/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /preview/i }))
    expect(onPreviewToast).toHaveBeenCalledTimes(1)
  })
})

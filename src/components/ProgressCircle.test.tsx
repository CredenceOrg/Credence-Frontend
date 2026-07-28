/* eslint-disable @typescript-eslint/no-unused-vars */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Progress, { ProgressCircle } from './Progress'

describe('ProgressCircle', () => {
  it.each(['sm', 'md', 'lg'] as const)('renders the %s size preset', (size) => {
    const { container } = render(<ProgressCircle value={50} size={size} />)

    expect(container.firstElementChild).toHaveClass(`progress-circle--${size}`)
  })

  it('renders a determinate progress value', () => {
    render(<ProgressCircle value={65} />)

    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveAttribute('aria-valuenow', '65')
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders the indeterminate state without a determinate value', () => {
    const { container } = render(<ProgressCircle indeterminate />)

    expect(container.firstElementChild).toHaveClass('progress-circle--indeterminate')
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })

  it.each(['primary', 'success', 'warning', 'danger'] as const)(
    'applies the %s colour variant',
    (variant) => {
      const { container } = render(<ProgressCircle value={50} variant={variant} />)

      expect(container.firstElementChild).toHaveClass(`progress-circle--${variant}`)
    },
  )

  it('preserves the zero-value boundary as determinate progress', () => {
    render(<ProgressCircle value={0} />)

    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).not.toHaveClass('progress-circle--indeterminate')
  })
})

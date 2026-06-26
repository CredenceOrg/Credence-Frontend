import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FocusTrapTestPage from './FocusTrapTestPage'

describe('FocusTrapTestPage accessibility', () => {
  it('gives placeholder-only trap inputs programmatic labels', () => {
    render(<FocusTrapTestPage />)

    const firstInput = screen.getByRole('textbox', { name: 'Focus trap input 1' })
    const secondInput = screen.getByRole('textbox', { name: 'Focus trap input 2' })

    expect(firstInput).toHaveAttribute('placeholder', 'Input 1')
    expect(secondInput).toHaveAttribute('placeholder', 'Input 2')

    expect(screen.queryByRole('textbox', { name: 'Input 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Input 2' })).not.toBeInTheDocument()
  })
})

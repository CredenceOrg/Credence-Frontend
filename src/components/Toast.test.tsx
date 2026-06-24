import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Toast from './Toast'

describe('Toast Component - Transaction Hash Logic', () => {
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    mockOnDismiss.mockClear()
    // Reset clipboard mock
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    })
  })

  it('renders a standard toast without tx meta', () => {
    render(<Toast toast={{ id: '1', severity: 'info', message: 'Hello' }} onDismiss={mockOnDismiss} />)
    
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByText('View on explorer')).not.toBeInTheDocument()
  })

  it('renders truncated tx hash and explorer link when txHash is provided', () => {
    const hash = '5e0f72782b2622dbfb5e44a50b38c2084c8a2cc15e8b4e72323e74be8ed01c13'
    render(<Toast toast={{ id: '2', severity: 'success', message: 'Created', txHash: hash, network: 'testnet' }} onDismiss={mockOnDismiss} />)
    
    // Hash should be truncated: first 8 ... last 8
    const truncated = '5e0f7278...8ed01c13'
    expect(screen.getByText(truncated)).toBeInTheDocument()
    
    const link = screen.getByRole('link', { name: /view on explorer/i })
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/tx/${hash}`)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('falls back to public network for explorer link if not provided', () => {
    const hash = 'b6d396a84d41bf162d05f32a51f8a846b0a6fb2abccedb441f71f11e9f1a2380'
    render(<Toast toast={{ id: '3', severity: 'success', message: 'Created', txHash: hash }} onDismiss={mockOnDismiss} />)
    
    const link = screen.getByRole('link', { name: /view on explorer/i })
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/public/tx/${hash}`)
  })

  it('copies the hash to clipboard when the copy button is clicked', async () => {
    const hash = 'b6d396a84d41bf162d05f32a51f8a846b0a6fb2abccedb441f71f11e9f1a2380'
    render(<Toast toast={{ id: '4', severity: 'success', message: 'Created', txHash: hash }} onDismiss={mockOnDismiss} />)
    
    const copyBtn = screen.getByRole('button', { name: /b6d396a8/i })
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(hash)
    
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument()
    })
  })

  it('fails gracefully if clipboard API throws', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.reject(new Error('Permission denied'))),
      },
    })
    
    const hash = 'b6d396a84d41bf162d05f32a51f8a846b0a6fb2abccedb441f71f11e9f1a2380'
    render(<Toast toast={{ id: '5', severity: 'success', message: 'Created', txHash: hash }} onDismiss={mockOnDismiss} />)
    
    const copyBtn = screen.getByRole('button', { name: /b6d396a8/i })
    fireEvent.click(copyBtn)

    // Wait and verify 'Copied' state does not appear due to catch
    await waitFor(() => {
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    })
  })
})

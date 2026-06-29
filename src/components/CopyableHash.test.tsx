import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CopyableHash from './CopyableHash'

// Mock useCopyToClipboard hook
vi.mock('@/hooks/useCopyToClipboard', () => ({
  default: vi.fn(() => ({
    copy: vi.fn().mockResolvedValue(true),
    copied: false,
    reset: vi.fn(),
  })),
}))

describe('CopyableHash', () => {
  it('renders the hash value in a code element', () => {
    render(<CopyableHash hash="0xabc123" />)
    expect(screen.getByText('0xabc123')).toBeInTheDocument()
  })

  it('renders a copy button', () => {
    render(<CopyableHash hash="0xabc123" />)
    const button = screen.getByRole('button', { name: /copy hash to clipboard/i })
    expect(button).toBeInTheDocument()
  })

  it('renders with custom aria-label when provided', () => {
    render(<CopyableHash hash="0xabc123" copyLabel="Copy transaction hash" />)
    const button = screen.getByRole('button', { name: /copy transaction hash/i })
    expect(button).toBeInTheDocument()
  })

  it('applies custom className when provided', () => {
    const { container } = render(<CopyableHash hash="0xabc123" className="custom-class" />)
    expect(container.querySelector('.copyable-hash')).toHaveClass('custom-class')
  })
})
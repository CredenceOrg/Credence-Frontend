import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Kbd from './Kbd'

vi.mock('./Kbd.css', () => ({}))

describe('Kbd', () => {
  // ─── Rendering ──────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders a <kbd> element', () => {
      render(<Kbd>Esc</Kbd>)
      const el = document.querySelector('kbd')
      expect(el).not.toBeNull()
      expect(el!.tagName.toLowerCase()).toBe('kbd')
    })

    it('renders the supplied key label as text content', () => {
      render(<Kbd>Enter</Kbd>)
      expect(screen.getByText('Enter')).toBeInTheDocument()
    })

    it('renders a single character key', () => {
      render(<Kbd>K</Kbd>)
      expect(screen.getByText('K')).toBeInTheDocument()
    })

    it('renders a platform symbol key', () => {
      render(<Kbd ariaLabel="Command">⌘</Kbd>)
      expect(screen.getByText('⌘')).toBeInTheDocument()
    })
  })

  // ─── CSS classes ─────────────────────────────────────────────────────────────

  describe('CSS classes', () => {
    it('always applies the base credence-kbd class', () => {
      render(<Kbd>X</Kbd>)
      const el = document.querySelector('.credence-kbd')
      expect(el).not.toBeNull()
    })

    it('applies credence-kbd--md by default', () => {
      render(<Kbd>X</Kbd>)
      expect(document.querySelector('.credence-kbd--md')).not.toBeNull()
    })

    it('applies credence-kbd--sm when size="sm"', () => {
      render(<Kbd size="sm">X</Kbd>)
      expect(document.querySelector('.credence-kbd--sm')).not.toBeNull()
    })

    it('applies credence-kbd--lg when size="lg"', () => {
      render(<Kbd size="lg">X</Kbd>)
      expect(document.querySelector('.credence-kbd--lg')).not.toBeNull()
    })

    it('appends extra class names via className prop', () => {
      render(<Kbd className="my-extra-class">X</Kbd>)
      const el = document.querySelector('.credence-kbd')
      expect(el).toHaveClass('my-extra-class')
    })

    it('does not produce a trailing space when no className is given', () => {
      render(<Kbd>X</Kbd>)
      const el = document.querySelector('.credence-kbd')
      expect(el?.className).not.toMatch(/^\s|\s$/)
    })
  })

  // ─── Accessibility ───────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('sets aria-label to children text by default', () => {
      render(<Kbd>Esc</Kbd>)
      const el = document.querySelector('.credence-kbd')
      expect(el).toHaveAttribute('aria-label', 'Esc')
    })

    it('uses the ariaLabel prop when provided', () => {
      render(<Kbd ariaLabel="Command">⌘</Kbd>)
      const el = document.querySelector('.credence-kbd')
      expect(el).toHaveAttribute('aria-label', 'Command')
    })

    it('aria-label falls back to children when ariaLabel is not given', () => {
      render(<Kbd>Shift</Kbd>)
      const el = document.querySelector('.credence-kbd')
      expect(el).toHaveAttribute('aria-label', 'Shift')
    })

    it('renders as a native <kbd> element (semantic keyboard text)', () => {
      render(<Kbd>Tab</Kbd>)
      expect(document.querySelector('kbd')).not.toBeNull()
    })
  })

  // ─── Size variants ────────────────────────────────────────────────────────────

  describe('size variants', () => {
    it.each([
      ['sm', 'credence-kbd--sm'],
      ['md', 'credence-kbd--md'],
      ['lg', 'credence-kbd--lg'],
    ] as const)('size="%s" adds class "%s"', (size, expectedClass) => {
      render(<Kbd size={size}>K</Kbd>)
      expect(document.querySelector(`.${expectedClass}`)).not.toBeNull()
    })

    it('only one size class is present at a time', () => {
      render(<Kbd size="lg">K</Kbd>)
      const el = document.querySelector('.credence-kbd')!
      const sizeClasses = Array.from(el.classList).filter((c) =>
        c.startsWith('credence-kbd--'),
      )
      expect(sizeClasses).toHaveLength(1)
      expect(sizeClasses[0]).toBe('credence-kbd--lg')
    })
  })

  // ─── Composite shortcut usage ─────────────────────────────────────────────────

  describe('composite shortcut usage', () => {
    it('renders multiple <Kbd> elements side-by-side', () => {
      render(
        <span>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>,
      )
      const keys = document.querySelectorAll('.credence-kbd')
      expect(keys).toHaveLength(2)
      expect(keys[0].textContent).toBe('Ctrl')
      expect(keys[1].textContent).toBe('K')
    })
  })
})

import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Progress from './Progress'

vi.mock('./Progress.css', () => ({}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the single progressbar element in the rendered output. */
function getBar(container: HTMLElement) {
  return container.querySelector('[role="progressbar"]') as HTMLElement
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Progress', () => {
  // -------------------------------------------------------------------------
  // Determinate path
  // -------------------------------------------------------------------------
  describe('determinate mode', () => {
    it('renders a progressbar element', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      expect(getBar(container)).not.toBeNull()
    })

    it('sets aria-valuenow to the supplied value', () => {
      const { container } = render(<Progress value={40} aria-label="Loading" />)
      expect(getBar(container)).toHaveAttribute('aria-valuenow', '40')
    })

    it('sets aria-valuemin to the default 0', () => {
      const { container } = render(<Progress value={40} aria-label="Loading" />)
      expect(getBar(container)).toHaveAttribute('aria-valuemin', '0')
    })

    it('sets aria-valuemax to the default 100', () => {
      const { container } = render(<Progress value={40} aria-label="Loading" />)
      expect(getBar(container)).toHaveAttribute('aria-valuemax', '100')
    })

    it('respects custom min and max props', () => {
      const { container } = render(
        <Progress value={5} min={0} max={10} aria-label="Loading" />
      )
      const bar = getBar(container)
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '10')
      expect(bar).toHaveAttribute('aria-valuenow', '5')
    })

    it('sets the --progress-fill CSS custom property to the correct percentage', () => {
      const { container } = render(<Progress value={75} aria-label="Loading" />)
      const fill = container.querySelector('.progress__fill') as HTMLElement
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('75%')
    })

    it('computes fill percentage relative to custom min/max', () => {
      // value=150 out of 0..200 => 75%
      const { container } = render(
        <Progress value={150} min={0} max={200} aria-label="Loading" />
      )
      const fill = container.querySelector('.progress__fill') as HTMLElement
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('75%')
    })

    it('clamps value below min to min', () => {
      const { container } = render(<Progress value={-10} min={0} max={100} aria-label="Loading" />)
      const bar = getBar(container)
      expect(bar).toHaveAttribute('aria-valuenow', '0')
      const fill = container.querySelector('.progress__fill') as HTMLElement
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('0%')
    })

    it('clamps value above max to max', () => {
      const { container } = render(<Progress value={200} min={0} max={100} aria-label="Loading" />)
      const bar = getBar(container)
      expect(bar).toHaveAttribute('aria-valuenow', '100')
      const fill = container.querySelector('.progress__fill') as HTMLElement
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('100%')
    })

    it('produces 0% fill when value equals min', () => {
      const { container } = render(<Progress value={0} min={0} max={100} aria-label="Loading" />)
      const fill = container.querySelector('.progress__fill') as HTMLElement
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('0%')
    })

    it('produces 100% fill when value equals max', () => {
      const { container } = render(<Progress value={100} min={0} max={100} aria-label="Loading" />)
      const fill = container.querySelector('.progress__fill') as HTMLElement
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('100%')
    })

    it('produces 0% fill when min equals max (division by zero guard)', () => {
      const { container } = render(
        <Progress value={50} min={50} max={50} aria-label="Loading" />
      )
      const fill = container.querySelector('.progress__fill') as HTMLElement
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('0%')
    })

    it('applies .progress--determinate class', () => {
      const { container } = render(<Progress value={30} aria-label="Loading" />)
      expect(container.querySelector('.progress--determinate')).not.toBeNull()
    })

    it('does NOT apply .progress--indeterminate class', () => {
      const { container } = render(<Progress value={30} aria-label="Loading" />)
      expect(container.querySelector('.progress--indeterminate')).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Indeterminate path
  // -------------------------------------------------------------------------
  describe('indeterminate mode', () => {
    it('renders a progressbar element', () => {
      const { container } = render(<Progress aria-label="Loading content" />)
      expect(getBar(container)).not.toBeNull()
    })

    it('does NOT set aria-valuenow', () => {
      const { container } = render(<Progress aria-label="Loading content" />)
      expect(getBar(container)).not.toHaveAttribute('aria-valuenow')
    })

    it('does NOT set aria-valuemin', () => {
      const { container } = render(<Progress aria-label="Loading content" />)
      expect(getBar(container)).not.toHaveAttribute('aria-valuemin')
    })

    it('does NOT set aria-valuemax', () => {
      const { container } = render(<Progress aria-label="Loading content" />)
      expect(getBar(container)).not.toHaveAttribute('aria-valuemax')
    })

    it('applies .progress--indeterminate class', () => {
      const { container } = render(<Progress aria-label="Loading content" />)
      expect(container.querySelector('.progress--indeterminate')).not.toBeNull()
    })

    it('does NOT apply .progress--determinate class', () => {
      const { container } = render(<Progress aria-label="Loading content" />)
      expect(container.querySelector('.progress--determinate')).toBeNull()
    })

    it('does NOT set an inline --progress-fill on the fill element', () => {
      const { container } = render(<Progress aria-label="Loading content" />)
      const fill = container.querySelector('.progress__fill') as HTMLElement
      // style attribute should be absent or empty for indeterminate
      expect(fill.style.getPropertyValue('--progress-fill')).toBe('')
    })
  })

  // -------------------------------------------------------------------------
  // ARIA semantics (both modes)
  // -------------------------------------------------------------------------
  describe('aria semantics', () => {
    it('exposes role="progressbar"', () => {
      const { container } = render(<Progress aria-label="Uploading" />)
      expect(getBar(container)).toHaveAttribute('role', 'progressbar')
    })

    it('aria-label is present and matches the supplied value — determinate', () => {
      const { container } = render(<Progress value={60} aria-label="Saving bond" />)
      expect(getBar(container)).toHaveAttribute('aria-label', 'Saving bond')
    })

    it('aria-label is present and matches the supplied value — indeterminate', () => {
      const { container } = render(<Progress aria-label="Fetching trust score" />)
      expect(getBar(container)).toHaveAttribute('aria-label', 'Fetching trust score')
    })

    it('the fill and track divs are aria-hidden so screen readers only see the wrapper', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      const track = container.querySelector('.progress__track') as HTMLElement
      expect(track).toHaveAttribute('aria-hidden', 'true')
    })
  })

  // -------------------------------------------------------------------------
  // Size variants
  // -------------------------------------------------------------------------
  describe('size variants', () => {
    it('defaults to size md', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      expect(container.querySelector('.progress--md')).not.toBeNull()
    })

    it('applies .progress--sm for size="sm"', () => {
      const { container } = render(<Progress value={50} size="sm" aria-label="Loading" />)
      expect(container.querySelector('.progress--sm')).not.toBeNull()
    })

    it('applies .progress--lg for size="lg"', () => {
      const { container } = render(<Progress value={50} size="lg" aria-label="Loading" />)
      expect(container.querySelector('.progress--lg')).not.toBeNull()
    })

    it('size variant class is also present in indeterminate mode', () => {
      const { container } = render(<Progress size="sm" aria-label="Loading" />)
      expect(container.querySelector('.progress--sm')).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Colour variants
  // -------------------------------------------------------------------------
  describe('colour variants', () => {
    it('applies .progress--color-primary by default', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      expect(container.querySelector('.progress--color-primary')).not.toBeNull()
    })

    it('applies .progress--color-success for color="success"', () => {
      const { container } = render(
        <Progress value={50} color="success" aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-success')).not.toBeNull()
    })

    it('applies .progress--color-warning for color="warning"', () => {
      const { container } = render(
        <Progress value={50} color="warning" aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-warning')).not.toBeNull()
    })

    it('applies .progress--color-danger for color="danger"', () => {
      const { container } = render(
        <Progress value={50} color="danger" aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-danger')).not.toBeNull()
    })

    it('colour variant class is present in indeterminate mode', () => {
      const { container } = render(
        <Progress color="success" aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-success')).not.toBeNull()
    })

    it('colour variant class combines correctly with size class', () => {
      const { container } = render(
        <Progress value={50} size="lg" color="danger" aria-label="Loading" />
      )
      expect(container.querySelector('.progress--lg')).not.toBeNull()
      expect(container.querySelector('.progress--color-danger')).not.toBeNull()
    })

    it('does not apply .progress--color-primary when a non-default variant is set', () => {
      const { container } = render(
        <Progress value={50} color="success" aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-primary')).toBeNull()
    })

    it('does not apply .progress--color-success when a different variant is set', () => {
      const { container } = render(
        <Progress value={50} color="warning" aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-success')).toBeNull()
    })

    it('colour variant does not interfere with striped class', () => {
      const { container } = render(
        <Progress value={50} color="danger" striped aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-danger')).not.toBeNull()
      expect(container.querySelector('.progress--striped')).not.toBeNull()
    })

    it('colour variant does not interfere with animated class', () => {
      const { container } = render(
        <Progress value={50} color="warning" animated aria-label="Loading" />
      )
      expect(container.querySelector('.progress--color-warning')).not.toBeNull()
      expect(container.querySelector('.progress--animated')).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // className prop
  // -------------------------------------------------------------------------
  describe('className prop', () => {
    it('appends a custom class to the root element', () => {
      const { container } = render(
        <Progress value={50} aria-label="Loading" className="my-progress" />
      )
      const root = container.querySelector('.progress') as HTMLElement
      expect(root).toHaveClass('my-progress')
    })

    it('does not produce a leading or trailing space in className', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      const root = container.querySelector('.progress') as HTMLElement
      expect(root.className).not.toMatch(/^\s|\s$/)
    })

    it('base .progress class is always present', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      expect(container.querySelector('.progress')).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Striped variant
  // -------------------------------------------------------------------------
  describe('striped variant', () => {
    it('applies .progress--striped when striped is true (determinate)', () => {
      const { container } = render(<Progress value={50} striped aria-label="Loading" />)
      expect(container.querySelector('.progress--striped')).not.toBeNull()
    })

    it('does NOT apply .progress--striped by default', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      expect(container.querySelector('.progress--striped')).toBeNull()
    })

    it('applies .progress--striped in indeterminate mode', () => {
      const { container } = render(<Progress striped aria-label="Loading" />)
      expect(container.querySelector('.progress--striped')).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Animated variant
  // -------------------------------------------------------------------------
  describe('animated variant', () => {
    it('applies .progress--animated when animated is true', () => {
      const { container } = render(<Progress value={50} animated aria-label="Loading" />)
      expect(container.querySelector('.progress--animated')).not.toBeNull()
    })

    it('implies striped when animated is true', () => {
      const { container } = render(<Progress value={50} animated aria-label="Loading" />)
      expect(container.querySelector('.progress--striped')).not.toBeNull()
    })

    it('does NOT apply .progress--animated by default', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      expect(container.querySelector('.progress--animated')).toBeNull()
    })

    it('applies .progress--animated in indeterminate mode', () => {
      const { container } = render(<Progress animated aria-label="Loading" />)
      expect(container.querySelector('.progress--animated')).not.toBeNull()
    })

    it('both striped and animated can be set explicitly', () => {
      const { container } = render(<Progress value={50} striped animated aria-label="Loading" />)
      expect(container.querySelector('.progress--striped')).not.toBeNull()
      expect(container.querySelector('.progress--animated')).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // DOM structure
  // -------------------------------------------------------------------------
  describe('DOM structure', () => {
    it('renders a track child inside the root', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      const track = container.querySelector('.progress .progress__track')
      expect(track).not.toBeNull()
    })

    it('renders a fill child inside the track', () => {
      const { container } = render(<Progress value={50} aria-label="Loading" />)
      const fill = container.querySelector('.progress__track .progress__fill')
      expect(fill).not.toBeNull()
    })
  })
})

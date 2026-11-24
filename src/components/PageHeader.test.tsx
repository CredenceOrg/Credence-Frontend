import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  test('required props only: title renders as h1; badge and action are absent', () => {
    render(<PageHeader title="Dashboard" description="Overview of your account" />)

    // Title is the sole h1 with the correct text
    const heading = screen.getByRole('heading', { level: 1, name: 'Dashboard' })
    expect(heading).toBeInTheDocument()

    // Exactly one h1 in the document
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    // No badge wrapper and no action wrapper rendered
    const root = heading.closest('.pageHeader')
    expect(root?.querySelector('.pageHeader__badge')).toBeNull()
    expect(root?.querySelector('.pageHeader__action')).toBeNull()
  })

  test('all optional props: h1 present; description, badge and action all render', () => {
    render(
      <PageHeader
        title="Settings"
        description="Manage your preferences"
        badge={<span>Beta</span>}
        action={<button type="button">Save</button>}
      />
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('Manage your preferences')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  test('slots are independent: badge only renders badge wrapper; action wrapper is absent', () => {
    const { unmount } = render(
      <PageHeader
        title="Reports"
        description="Your reports"
        badge={<span>New</span>}
      />
    )

    const root = screen.getByRole('banner')
    expect(root.querySelector('.pageHeader__badge')).not.toBeNull()
    expect(root.querySelector('.pageHeader__action')).toBeNull()
    unmount()

    render(
      <PageHeader
        title="Reports"
        description="Your reports"
        action={<button type="button">Export</button>}
      />
    )

    const root2 = screen.getByRole('banner')
    expect(root2.querySelector('.pageHeader__badge')).toBeNull()
    expect(root2.querySelector('.pageHeader__action')).not.toBeNull()
  })

  test('structure classes: root and child elements carry the CSS class names from the component', () => {
    render(
      <PageHeader
        title="Attestations"
        description="Review submitted attestations"
        badge={<span>3</span>}
        action={<button type="button">Review</button>}
      />
    )

    const root = screen.getByRole('banner')
    expect(root).toHaveClass('pageHeader')
    expect(root.querySelector('.pageHeader__main')).not.toBeNull()
    expect(root.querySelector('.pageHeader__titleRow')).not.toBeNull()
    expect(root.querySelector('.pageHeader__title')).not.toBeNull()
    expect(root.querySelector('.pageHeader__description')).not.toBeNull()
    expect(root.querySelector('.pageHeader__badge')).not.toBeNull()
    expect(root.querySelector('.pageHeader__action')).not.toBeNull()
  })
})

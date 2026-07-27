import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RepoAvatar from './RepoAvatar'

describe('RepoAvatar', () => {
  it('renders with default medium (md) size preset', () => {
    const { container } = render(<RepoAvatar name="CredenceOrg/Credence-Frontend" />)

    const avatar = container.querySelector('.credence-repo-avatar')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveClass('credence-repo-avatar--md')
  })

  it('applies custom tokenised size presets (sm, md, lg)', () => {
    const { container: containerSm } = render(<RepoAvatar size="sm" name="repo" />)
    expect(containerSm.querySelector('.credence-repo-avatar--sm')).toBeInTheDocument()

    const { container: containerMd } = render(<RepoAvatar size="md" name="repo" />)
    expect(containerMd.querySelector('.credence-repo-avatar--md')).toBeInTheDocument()

    const { container: containerLg } = render(<RepoAvatar size="lg" name="repo" />)
    expect(containerLg.querySelector('.credence-repo-avatar--lg')).toBeInTheDocument()
  })

  it('renders image when src is provided', () => {
    render(<RepoAvatar src="https://example.com/avatar.png" name="Credence" />)

    const img = screen.getByRole('img', { name: /Credence repository avatar/i })
    expect(img).toBeInTheDocument()
    const imgEl = containerImage(img)
    expect(imgEl).toHaveAttribute('src', 'https://example.com/avatar.png')
  })

  it('renders fallback initials when src is omitted', () => {
    render(<RepoAvatar name="CredenceOrg/Credence-Frontend" />)

    expect(screen.getByText('CC')).toBeInTheDocument()
  })

  it('computes initials correctly for single and multi-word names', () => {
    const { rerender } = render(<RepoAvatar name="Credence Frontend" />)
    expect(screen.getByText('CF')).toBeInTheDocument()

    rerender(<RepoAvatar name="Credence" />)
    expect(screen.getByText('CR')).toBeInTheDocument()
  })

  it('renders fallback SVG icon when name and src are omitted', () => {
    const { container } = render(<RepoAvatar />)

    const svg = container.querySelector('svg.credence-repo-avatar__icon')
    expect(svg).toBeInTheDocument()
  })

  it('falls back to initials when image load fails', () => {
    render(
      <RepoAvatar src="https://example.com/invalid.png" name="CredenceOrg/Credence-Frontend" />
    )

    const img = screen.getByAltText('CredenceOrg/Credence-Frontend')
    expect(img).toBeInTheDocument()

    // Trigger onError
    fireEvent.error(img)

    expect(screen.getByText('CC')).toBeInTheDocument()
  })

  it('applies custom className and forwards extra DOM attributes', () => {
    const { container } = render(
      <RepoAvatar name="Test" className="my-custom-avatar" data-testid="custom-avatar" />
    )

    const avatar = container.querySelector('.my-custom-avatar')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveAttribute('data-testid', 'custom-avatar')
  })
})

function containerImage(element: HTMLElement): HTMLElement {
  if (element.tagName === 'IMG') return element
  const img = element.querySelector('img')
  return (img || element) as HTMLElement
}

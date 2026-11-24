import { HTMLAttributes, useState, useEffect } from 'react'
import { REPO_AVATAR_SIZES, RepoAvatarSize, DEFAULT_REPO_AVATAR_SIZE } from '../config/avatar'
import './RepoAvatar.css'

export interface RepoAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Avatar image URL */
  src?: string
  /** Repository or organization name, used for fallback initials and accessibility label */
  name?: string
  /** Tokenised size preset */
  size?: RepoAvatarSize
  /** Image alternative text override */
  alt?: string
  /** Additional CSS class names */
  className?: string
}

/**
 * Computes uppercase initials from a repository or organization name.
 * e.g. "CredenceOrg/Credence-Frontend" -> "CF", "React" -> "RE"
 */
function getInitials(name?: string): string {
  if (!name) return ''
  const trimmed = name.trim()
  if (!trimmed) return ''

  // If repo format "owner/repo"
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/')
    const owner = parts[0].trim()
    const repo = parts[1].trim()
    const first = owner ? owner[0] : ''
    const second = repo ? repo[0] : ''
    return (first + second).toUpperCase()
  }

  // If multi-word "Credence Frontend"
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }

  return trimmed.slice(0, 2).toUpperCase()
}

/**
 * RepoAvatar component supporting tokenised sizing presets (`sm`, `md`, `lg`)
 * tied directly to design tokens.
 */
export default function RepoAvatar({
  src,
  name,
  size = DEFAULT_REPO_AVATAR_SIZE,
  alt,
  className = '',
  'aria-label': ariaLabel,
  ...props
}: RepoAvatarProps) {
  const [hasError, setHasError] = useState(false)

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false)
  }, [src])

  const normalizedSize: RepoAvatarSize =
    size && size in REPO_AVATAR_SIZES ? size : DEFAULT_REPO_AVATAR_SIZE

  const initials = getInitials(name)
  const accessibleLabel =
    ariaLabel || alt || (name ? `${name} repository avatar` : 'Repository avatar')

  const containerClasses = [
    'credence-repo-avatar',
    `credence-repo-avatar--${normalizedSize}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const showImage = Boolean(src) && !hasError

  return (
    <span role="img" aria-label={accessibleLabel} className={containerClasses} {...props}>
      {showImage ? (
        <img
          src={src}
          alt={alt || name || 'Repository avatar'}
          className="credence-repo-avatar__img"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="credence-repo-avatar__fallback" aria-hidden="true">
          {initials ? (
            initials
          ) : (
            <svg
              className="credence-repo-avatar__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      )}
    </span>
  )
}

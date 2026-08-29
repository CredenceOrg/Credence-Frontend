/**
 * Centralized configuration and sizing presets for RepoAvatar component.
 */

export const REPO_AVATAR_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const

export type RepoAvatarSize = keyof typeof REPO_AVATAR_SIZES

export const DEFAULT_REPO_AVATAR_SIZE: RepoAvatarSize = 'md'

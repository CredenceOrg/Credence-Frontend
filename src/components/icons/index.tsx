import { lazy, Suspense, type ComponentType, type ReactElement } from 'react'
import type { IconProps } from './Icon'

export { default as Icon } from './Icon'

type LazyIconLoader = () => Promise<{ default: ComponentType<IconProps> }>

/**
 * Keep icon consumers synchronous while loading SVG implementations only when
 * a route actually renders them. The null fallback preserves the old compact
 * layout during the one-frame chunk fetch and the app-level Suspense boundary
 * still handles route-level loading states.
 */
function lazyIcon(loader: LazyIconLoader) {
  const Component = lazy(loader)
  return function LazyIcon(props: IconProps): ReactElement | null {
    return (
      <Suspense fallback={null}>
        <Component {...props} />
      </Suspense>
    )
  }
}

export const CopyIcon = lazyIcon(() => import('./CopyIcon'))
export const CheckIcon = lazyIcon(() => import('./CheckIcon'))
export const ExternalLinkIcon = lazyIcon(() => import('./ExternalLinkIcon'))
export const WalletIcon = lazyIcon(() => import('./WalletIcon'))

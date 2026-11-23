import {
  type ComponentType,
  type ComponentProps,
  lazy,
  forwardRef,
  createElement,
  type LazyExoticComponent,
  type ForwardRefExoticComponent,
  type PropsWithoutRef,
  type RefAttributes,
} from 'react'

export const CHUNK_RELOAD_STORAGE_KEY = 'credence_chunk_reload_attempted'

/**
 * Checks if a reload has already been performed in the current session
 * to prevent reload loops caused by persistent chunk load failures.
 */
export function hasAttemptedChunkReload(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Marks that a chunk reload has been attempted for this session.
 */
export function markChunkReloadAttempted(): void {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, 'true')
  } catch {
    // Ignore storage errors in restricted/private contexts
  }
}

/**
 * Executes a single guarded document reload. If a reload was already attempted
 * in this session, this is a no-op to prevent reload loops.
 */
export function reloadPageGuarded(): void {
  if (hasAttemptedChunkReload()) {
    return
  }
  markChunkReloadAttempted()
  window.location.reload()
}

const activeChunkResetCallbacks = new Set<() => void>()

/**
 * Resets all active lazy chunk wrappers so their next render attempts a fresh import.
 * Invoked by ErrorBoundary on handleReset, resetAll, or resetKey changes.
 */
export function resetAllLazyChunks(): void {
  activeChunkResetCallbacks.forEach((reset) => reset())
}

export type ComponentFactory<T extends ComponentType<unknown>> = () => Promise<{ default: T }>

export interface RetryableLazyComponent<T extends ComponentType<unknown>>
  extends ForwardRefExoticComponent<PropsWithoutRef<ComponentProps<T>> & RefAttributes<unknown>> {
  preload: () => Promise<{ default: T }>
  reset: () => void
}

/**
 * Wraps a dynamic component import factory in a resilient lazy loader.
 *
 * In standard React.lazy, rejected import promises are permanently memoised,
 * meaning any subsequent render attempts will immediately re-throw the original error
 * without calling the import factory again.
 *
 * `lazyWithRetry` invalidates its internal React.lazy instance upon reset (either via ErrorBoundary
 * recovery or explicit reset), ensuring that the next attempt invokes the import factory again.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: ComponentFactory<T>
): RetryableLazyComponent<T> {
  let currentLazy: LazyExoticComponent<T> | null = null

  function reset(): void {
    currentLazy = null
  }

  activeChunkResetCallbacks.add(reset)

  function getLazyComponent(): LazyExoticComponent<T> {
    if (!currentLazy) {
      currentLazy = lazy(factory as () => Promise<{ default: ComponentType<ComponentProps<T>> }>) as LazyExoticComponent<T>
    }
    return currentLazy
  }

  const LazyWrapper = forwardRef<unknown, ComponentProps<T>>((props, ref) => {
    return createElement(getLazyComponent() as unknown as ComponentType<Record<string, unknown>>, {
      ...(props as object),
      ref,
    })
  }) as RetryableLazyComponent<T>

  LazyWrapper.preload = () => factory()
  LazyWrapper.reset = reset

  return LazyWrapper
}

export default lazyWithRetry

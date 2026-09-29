import { useEffect } from 'react'

export interface UseScrollPreserverOptions {
  isActive: boolean
}

export function useScrollPreserver({ isActive }: UseScrollPreserverOptions): void {
  useEffect(() => {
    if (!isActive) return

    const scrollY = window.scrollY
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      window.scrollTo(0, scrollY)
    }
  }, [isActive])
}

import { useEffect, useState } from 'react'

export const BACK_TO_TOP_SCROLL_THRESHOLD = 800

export function useScrollToTop(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > BACK_TO_TOP_SCROLL_THRESHOLD)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return visible
}

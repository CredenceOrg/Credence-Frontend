import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { LONG_LIST_RENDER_THRESHOLD } from '../config/listing'

export interface WindowedListProps<T> {
  items: readonly T[]
  itemHeight: number
  overscan?: number
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  role?: string
  ariaLabel?: string
  emptyMessage?: string
  getItemKey?: (item: T, index: number) => string | number
  containerHeight?: number
}

const DEFAULT_OVERSCAN = 4

export default function WindowedList<T>({
  items,
  itemHeight,
  overscan = DEFAULT_OVERSCAN,
  renderItem,
  className,
  role,
  ariaLabel,
  emptyMessage,
  getItemKey,
  containerHeight = 320,
}: WindowedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(containerHeight)
  const containerRef = useRef<HTMLDivElement>(null)

  const isLongList = items.length >= LONG_LIST_RENDER_THRESHOLD
  const totalHeight = Math.max(items.length * itemHeight, 0)
  const resolvedContainerHeight = Math.max(containerHeight, 0)

  const visibleRange = useMemo(() => {
    if (!isLongList) {
      return { start: 0, end: items.length }
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
    )

    return { start: startIndex, end: endIndex }
  }, [isLongList, itemHeight, items.length, overscan, scrollTop, viewportHeight])

  useEffect(() => {
    if (!containerRef.current) return

    const element = containerRef.current
    const updateViewportHeight = () => {
      const height = element.clientHeight || containerHeight
      setViewportHeight(height)
    }

    const handleScroll = () => setScrollTop(element.scrollTop)

    updateViewportHeight()
    handleScroll()
    element.addEventListener('scroll', handleScroll)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateViewportHeight)
      observer.observe(element)
      return () => {
        observer.disconnect()
        element.removeEventListener('scroll', handleScroll)
      }
    }

    window.addEventListener('resize', updateViewportHeight)
    return () => {
      window.removeEventListener('resize', updateViewportHeight)
      element.removeEventListener('scroll', handleScroll)
    }
  }, [containerHeight])

  if (items.length === 0) {
    return emptyMessage ? <p className={className}>{emptyMessage}</p> : null
  }

  const renderItemContent = (item: T, index: number) => {
    const content = renderItem(item, index)

    if (isValidElement(content)) {
      return cloneElement(content, {
        style: {
          ...(content.props.style ?? {}),
          minHeight: `${itemHeight}px`,
        },
      })
    }

    return <div style={{ minHeight: `${itemHeight}px` }}>{content}</div>
  }

  if (!isLongList) {
    return (
      <div className={className} role={role} aria-label={ariaLabel}>
        {items.map((item, index) => (
          <div key={getItemKey ? getItemKey(item, index) : index}>
            {renderItemContent(item, index)}
          </div>
        ))}
      </div>
    )
  }

  const visibleItems = items.slice(visibleRange.start, visibleRange.end)
  const offsetY = visibleRange.start * itemHeight

  return (
    <div
      ref={containerRef}
      className={className}
      role={role}
      aria-label={ariaLabel}
      style={{ height: `${resolvedContainerHeight}px`, overflowY: 'auto' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const itemIndex = visibleRange.start + index
            const key = getItemKey ? getItemKey(item, itemIndex) : itemIndex

            return (
              <div key={key} style={{ minHeight: `${itemHeight}px` }}>
                {renderItemContent(item, itemIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

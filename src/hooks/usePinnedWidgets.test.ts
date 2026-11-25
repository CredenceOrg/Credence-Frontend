import { renderHook, act } from '@testing-library/react'
import { usePinnedWidgets } from './usePinnedWidgets'

describe('usePinnedWidgets', () => {
  beforeEach(() => localStorage.clear())

  it('pins and unpins a widget', () => {
    const { result } = renderHook(() => usePinnedWidgets())
    act(() => result.current.togglePin('trust-score'))
    expect(result.current.isPinned('trust-score')).toBe(true)
    act(() => result.current.togglePin('trust-score'))
    expect(result.current.isPinned('trust-score')).toBe(false)
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => usePinnedWidgets())
    act(() => result.current.togglePin('active-bonds'))
    expect(JSON.parse(localStorage.getItem('credence:pinned_widgets')!)).toContain('active-bonds')
  })

  it.each([JSON.stringify({ slug: 'trust-score' }), JSON.stringify(42)])(
    'ignores non-array stored data: %s',
    (stored) => {
      localStorage.setItem('credence:pinned_widgets', stored)

      const { result } = renderHook(() => usePinnedWidgets())

      expect(result.current.pinned).toEqual([])
    }
  )

  it('ignores arrays containing non-string entries', () => {
    localStorage.setItem('credence:pinned_widgets', JSON.stringify(['trust-score', 42]))

    const { result } = renderHook(() => usePinnedWidgets())

    expect(result.current.pinned).toEqual([])
  })

  it('removes duplicate stored widgets and respects the maximum', () => {
    localStorage.setItem('credence:pinned_widgets', JSON.stringify(['a', 'a', 'b', 'c', 'd', 'e']))

    const { result } = renderHook(() => usePinnedWidgets())

    expect(result.current.pinned).toEqual(['a', 'b', 'c', 'd'])
  })

  it('truncates oversized stored arrays to the maximum', () => {
    localStorage.setItem('credence:pinned_widgets', JSON.stringify(['a', 'b', 'c', 'd', 'e']))

    const { result } = renderHook(() => usePinnedWidgets())

    expect(result.current.pinned).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps valid stored arrays unchanged', () => {
    const stored = ['transactions', 'trust-score', 'active-bonds']
    localStorage.setItem('credence:pinned_widgets', JSON.stringify(stored))

    const { result } = renderHook(() => usePinnedWidgets())

    expect(result.current.pinned).toEqual(stored)
  })

  it('caps at MAX_PINNED_WIDGETS', () => {
    const { result } = renderHook(() => usePinnedWidgets())
    act(() => {
      result.current.togglePin('a')
      result.current.togglePin('b')
      result.current.togglePin('c')
      result.current.togglePin('d')
      result.current.togglePin('e')
    })
    expect(result.current.pinned.length).toBe(4)
  })

  it('moves a pinned widget and persists the new order', () => {
    localStorage.setItem('credence:pinned_widgets', JSON.stringify(['a', 'b', 'c']))
    const { result } = renderHook(() => usePinnedWidgets())

    act(() => result.current.move('c', -1))

    expect(result.current.pinned).toEqual(['a', 'c', 'b'])
    expect(JSON.parse(localStorage.getItem('credence:pinned_widgets')!)).toEqual(['a', 'c', 'b'])
  })

  it('keeps the order unchanged when moving beyond the bounds or an unpinned widget', () => {
    localStorage.setItem('credence:pinned_widgets', JSON.stringify(['a', 'b']))
    const { result } = renderHook(() => usePinnedWidgets())

    act(() => {
      result.current.move('a', -1)
      result.current.move('not-pinned', 1)
    })

    expect(result.current.pinned).toEqual(['a', 'b'])
  })
})

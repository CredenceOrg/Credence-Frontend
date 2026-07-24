import { renderHook, act } from '@testing-library/react';
import { usePinnedWidgets } from './usePinnedWidgets';

describe('usePinnedWidgets', () => {
  beforeEach(() => localStorage.clear());

  it('pins and unpins a widget', () => {
    const { result } = renderHook(() => usePinnedWidgets());
    act(() => result.current.togglePin('trust-score'));
    expect(result.current.isPinned('trust-score')).toBe(true);
    act(() => result.current.togglePin('trust-score'));
    expect(result.current.isPinned('trust-score')).toBe(false);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => usePinnedWidgets());
    act(() => result.current.togglePin('active-bonds'));
    expect(JSON.parse(localStorage.getItem('credence:pinnedWidgets')!)).toContain('active-bonds');
  });

  it('caps at MAX_PINNED_WIDGETS', () => {
    const { result } = renderHook(() => usePinnedWidgets());
    act(() => {
      result.current.togglePin('a');
      result.current.togglePin('b');
      result.current.togglePin('c');
      result.current.togglePin('d');
      result.current.togglePin('e');
    });
    expect(result.current.pinned.length).toBe(4);
  });
});

import { useState, useCallback, useEffect } from 'react';
import { PINNED_WIDGETS_STORAGE_KEY, MAX_PINNED_WIDGETS } from '../config/pinnedWidgets';

export function usePinnedWidgets() {
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_WIDGETS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_WIDGETS_STORAGE_KEY, JSON.stringify(pinned));
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fail silently
    }
  }, [pinned]);

  const togglePin = useCallback((slug: string) => {
    setPinned((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug].slice(0, MAX_PINNED_WIDGETS)
    );
  }, []);

  const isPinned = useCallback((slug: string) => pinned.includes(slug), [pinned]);

  return { pinned, togglePin, isPinned };
}
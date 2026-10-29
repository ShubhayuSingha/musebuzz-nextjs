// src/hooks/useFuzzyFilter.ts
import { useMemo } from 'react';
import Fuse from 'fuse.js';

/**
 * Custom hook to filter an array of items using Fuse.js fuzzy matching.
 * Allows typos, partial words, and approximate spelling (near-enough typing).
 *
 * @param items Array of data objects
 * @param query Search query string
 * @param keys Fuse.js search keys with optional weights
 * @param threshold Fuzzy matching threshold (0.0 = exact, 1.0 = match anything). Default: 0.38
 */
export function useFuzzyFilter<T>(
  items: T[],
  query: string,
  keys: Array<string | { name: string; weight: number }>,
  threshold: number = 0.38
): T[] {
  // Stabilize keys across renders even if passed as inline literals
  const keysStr = JSON.stringify(keys);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedKeys = useMemo(() => keys, [keysStr]);

  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: memoizedKeys,
      threshold,
      ignoreLocation: true,
      minMatchCharLength: 1,
      shouldSort: true,
    });
  }, [items, memoizedKeys, threshold]);

  return useMemo(() => {
    const trimmed = query?.trim() || '';
    if (!trimmed) {
      return items;
    }
    return fuse.search(trimmed).map((result) => result.item);
  }, [items, query, fuse]);
}

export default useFuzzyFilter;

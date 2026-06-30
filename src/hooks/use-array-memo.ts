import { useMemo, useRef } from 'react'

/**
 * Memo an array reference if it doesn't change
 * @param arr The array to memo
 * @returns   The memoed array
 */
export function useArrayMemo<T extends readonly any[]> (arr: T): T {
  const memoed = useRef(arr)

  // `useMemo` so update runs before everything
  useMemo(() => {
    if (arr.length !== memoed.current.length || arr.some((e, i) => e !== memoed.current[i])) memoed.current = arr
  }, [arr])

  return memoed.current
}

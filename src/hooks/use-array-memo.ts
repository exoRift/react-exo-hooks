import { useEffect, useState } from 'react'

/**
 * Memo an array reference if it doesn't change
 * @param arr The array to memo
 * @returns   The memoed array
 */
export function useArrayMemo<T extends readonly any[]> (arr: T): T {
  const [memoed, setMemoed] = useState(arr)

  useEffect(() => {
    if (arr.length !== memoed.length || arr.some((e, i) => e !== memoed[i])) setMemoed(arr)
  }, [arr])

  return memoed
}

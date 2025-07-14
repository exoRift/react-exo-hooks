import { useEffect, useState } from 'react'

const DEFAULT_TIMEOUT_MS = 1000

/**
 * Debounced setState
 * @param initial   The initial state value
 * @param timeoutMs The debounce interval
 * @returns         [state, setState, real]
 */
export function useDebouncedState<T> (initial: T, timeoutMs = DEFAULT_TIMEOUT_MS): [state: T, setState: React.Dispatch<React.SetStateAction<T>>, real: T] {
  const [debounced, setDebounced] = useState(initial)
  const [real, setReal] = useState(initial)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(real)
    }, timeoutMs)

    return () => clearTimeout(timeout)
  }, [real, timeoutMs])

  return [debounced, setReal, real]
}

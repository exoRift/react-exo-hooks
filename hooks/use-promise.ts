import { useEffect, useMemo, useReducer, useRef } from 'react'

export type PromiseResult<T, P extends boolean, E = unknown> = {
  state: 'waiting'
  result: P extends true ? T | undefined : undefined
  error: P extends true ? E | undefined : undefined
} | {
  state: 'resolved'
  result: T
  error: P extends true ? E | undefined : undefined
} | {
  state: 'rejected'
  result: P extends true ? T | undefined : undefined
  error: E
}

/**
 * A hook that dynamically refetches data on dependency update
 * @note The first-order function runs on server-side and client-side and determines whether the async second-order function should run client-side
 * @param fn      The async function to run
 * @param deps    The dependencies
 * @param persist Persist result values and error values into states that wouldn't normally have them
 * @returns       An object containing the state and settled values
 */
export function useFetch<T, P extends boolean, E = unknown> (
  fn: () => false | undefined | null | '' | ((signal?: AbortSignal) => Promise<T>),
  deps: React.DependencyList = [],
  persist?: P
): PromiseResult<T, P, E> {
  const value = useRef<PromiseResult<T, P, E>>({
    state: 'waiting',
    result: undefined,
    error: undefined
  })

  // Manage renders manually so everything can be a ref for instantaneous state changes
  const [, rerender] = useReducer(() => ({}), {})

  // useMemo runs before any other hook
  const callback = useMemo(() => {
    const cb = fn()

    value.current = {
      state: 'waiting',
      result: persist ? value.current.result : undefined,
      error: persist ? value.current.error : undefined
    } as PromiseResult<T, P, E>

    rerender()

    return cb
  }, deps)

  useEffect(() => {
    if (!callback) return

    const aborter = new AbortController()

    callback(aborter.signal)
      .then((result) => {
        if (aborter.signal.aborted) return // Don't act upon result
        value.current = {
          state: 'resolved',
          result,
          error: persist ? value.current.error : undefined
        } as PromiseResult<T, P, E>
        rerender()
      })
      .catch((err) => {
        if (!aborter.signal.aborted) {
          value.current = {
            state: 'rejected',
            result: persist ? value.current.result : undefined,
            error: err
          } as PromiseResult<T, P, E>
          rerender()
        }
      })

    return () => aborter.abort()
  }, [callback])

  return value.current
}

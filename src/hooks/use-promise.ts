import { useEffect, useMemo, useReducer, useRef } from 'react'

export type PromiseResult<T, E = unknown, P extends boolean = false> = {
  /** The state where fn returns a falsy value or is mid-evaluation */
  state: 'waiting'
  /** The resolved value */
  result: P extends true ? T | undefined : undefined
  /** The error thrown */
  error: P extends true ? E | undefined : undefined
} | {
  /** The state where fn has resolved to a value */
  state: 'resolved'
  /** The resolved value */
  result: T
  /** The error thrown */
  error: P extends true ? E | undefined : undefined
} | {
  /** The state where fn has thrown an error */
  state: 'rejected'
  /** The resolved value */
  result: P extends true ? T | undefined : undefined
  /** The error thrown */
  error: E
}

export type UsePromiseReturnType<T, E = unknown, P extends boolean = false> = PromiseResult<T, E, P> & {
  /** Force the fn to rerun */
  rerun: () => void
}

/**
 * A hook that dynamically refetches data on dependency update
 * @note The first-order function runs on server-side and client-side and determines whether the async second-order function should run client-side
 * @param fn      A function that returns a falsy value to skip OR The async function to run
 * @param deps    The dependencies that cause the async function to rerun
 * @param persist Persist result values and error values into states that wouldn't normally have them
 * @returns       An object containing the state and settled values as well as a callback to force a rerun of the fn
 */
export function usePromise<T, E = unknown, P extends boolean = false> (
  fn: () => false | undefined | null | '' | ((signal?: AbortSignal) => Promise<T>),
  deps: React.DependencyList = [],
  persist?: P
): UsePromiseReturnType<T, E, P> {
  // Manage renders manually so everything can be a ref for instantaneous state changes
  const [, rerender] = useReducer(() => ({}), {})
  const [rerunSignal, rerun] = useReducer(() => ({}), {})

  const value = useRef<UsePromiseReturnType<T, E, P>>({
    state: 'waiting',
    result: undefined,
    error: undefined,
    rerun
  })

  // useMemo runs before any other hook
  const callback = useMemo(() => {
    const cb = fn()

    value.current = {
      state: 'waiting',
      result: persist ? value.current.result : undefined,
      error: persist ? value.current.error : undefined,
      rerun
    } as UsePromiseReturnType<T, E, P>

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
          error: persist ? value.current.error : undefined,
          rerun
        } as UsePromiseReturnType<T, E, P>
        rerender()
      })
      .catch((err) => {
        if (!aborter.signal.aborted) {
          value.current = {
            state: 'rejected',
            result: persist ? value.current.result : undefined,
            error: err,
            rerun
          } as UsePromiseReturnType<T, E, P>
          rerender()
        }
      })

    return () => aborter.abort()
  }, [callback, rerunSignal])

  return value.current
}

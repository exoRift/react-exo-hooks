import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * A set that rerenders on changes
 * @note All calls to forceUpdate are nullishly coalesced
 * @note because cloning methods will attempt to apply the overrides to vanilla instances
 */
export class StatefulSet<T> extends Set<T> {
  /** Force an update to register on the set */
  forceUpdate: () => void = () => {}
  /** Set the instance to an entirely new instance */
  reset: (source: ConstructorParameters<typeof Set<T>>[0]) => void = () => {}

  /**
   * Toggle if an element is present within the set
   * @param value The value to toggle
   * @returns     The new state: true if the value is now in the set, false if the value is now not in the set
   */
  toggle (value: T): boolean {
    if (super.has(value)) {
      super.delete(value)
      this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition
      return false
    } else {
      super.add(value)
      this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition
      return false
    }
  }

  override add (value: T): this { // eslint-disable-line jsdoc/require-jsdoc
    if (!super.has(value)) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.add(value)
  }

  override delete (value: T): boolean { // eslint-disable-line jsdoc/require-jsdoc
    if (super.has(value)) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.delete(value)
  }

  override clear (): void { // eslint-disable-line jsdoc/require-jsdoc
    if (super.size) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.clear()
  }
}

/**
 * Create a clone of a set that updates on mutation
 * To listen on changes in hook dependencies, coerce to a numeric type (`+set`)
 * @param source The source set or entry data
 * @returns      The stateful set
 */
export function useSet<T> (source?: ConstructorParameters<typeof Set<T>>[0]): StatefulSet<T> {
  const revoked = useRef(false)
  const [signal, setSignal] = useState(0)

  const [set, _setSet] = useState(new StatefulSet(source))
  const update = useCallback(() => revoked.current ? undefined : setSignal((prior) => prior + 1), [])
  const setSet = useCallback((src: ConstructorParameters<typeof Set<T>>[0]) => { _setSet(new StatefulSet(src)); update() }, [update])
  set.forceUpdate = update
  set.reset = setSet
  set.valueOf = () => signal

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return set
}

import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * A map that rerenders on changes
 * @note All calls to forceUpdate are nullishly coalesced
 * @note because cloning methods will attempt to apply the overrides to vanilla instances
 */
export class StatefulMap<K, T> extends Map<K, T> {
  /** Force an update to register on the map */
  forceUpdate: () => void = () => {}
  /** Set the instance to an entirely new instance */
  reset: (source: ConstructorParameters<typeof Map<K, T>>[0]) => void = () => {}

  /**
   * Bulk set an array of items
   * @param items An array of items
   * @param keyFn Either the name of a property of each item or a function that returns the key for each item
   * @returns     this
   */
  bulkSet<U extends K & keyof T> (items: T[], keyFn: U | ((i: T) => U)): this {
    let wasUpdated = false

    for (const item of items) {
      const key = (typeof keyFn === 'function' ? keyFn(item) : item[keyFn]) as K

      if (!wasUpdated && (!super.has(key) || super.get(key) !== item)) wasUpdated = true
      super.set(key, item)
    }

    if (wasUpdated) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    return this
  }

  override set (key: K, value: T): this { // eslint-disable-line jsdoc/require-jsdoc
    if (!super.has(key) || super.get(key) !== value) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.set(key, value)
  }

  override clear (): void { // eslint-disable-line jsdoc/require-jsdoc
    if (super.size) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.clear()
  }

  override delete (key: K): boolean { // eslint-disable-line jsdoc/require-jsdoc
    if (super.has(key)) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.delete(key)
  }

  override getOrInsert (key: K, defaultValue: T): T { // eslint-disable-line jsdoc/require-jsdoc
    if (!super.has(key)) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.getOrInsert(key, defaultValue)
  }

  override getOrInsertComputed (key: K, callback: (key: K) => T): T { // eslint-disable-line jsdoc/require-jsdoc
    if (!super.has(key)) this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    return super.getOrInsertComputed(key, callback)
  }
}

/**
 * Create a clone of a map that updates on mutation
 * To listen on changes in hook dependencies, coerce to a numeric type (`+map`)
 * @param source The source map or entry data
 * @returns      The stateful map
 */
export function useMap<K, T> (source?: ConstructorParameters<typeof Map<K, T>>[0]): StatefulMap<K, T> {
  const revoked = useRef(false)
  const [signal, setSignal] = useState(0)

  const [map, _setMap] = useState(new StatefulMap(source))
  const update = useCallback(() => revoked.current ? undefined : setSignal((prior) => prior + 1), [])
  const setMap = useCallback((src: ConstructorParameters<typeof Map<K, T>>[0]) => { _setMap(new StatefulMap(src)); update() }, [update])
  map.forceUpdate = update
  map.reset = setMap
  map.valueOf = () => signal

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return map
}

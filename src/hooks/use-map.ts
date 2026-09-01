import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

/**
 * A map that rerenders on changes
 * @note All calls to forceUpdate are nullishly coalesced
 * @note because cloning methods will attempt to apply the overrides to vanilla instances
 */
export class StatefulMap<K, T> extends Map<K, T> {
  /** Force an update to register on the map */
  forceUpdate: () => void = () => {}

  /**
   * A constant reference to the underlying map
   * @note Mutating through this reference still triggers updates, but the reference never changes,
   * @note so it can be listed as a hook dependency without invalidating memos on every write
   * @returns The underlying map
   */
  get writer (): this {
    return this
  }

  /**
   * Replace the contents of the map in-place, preserving the reference
   * @param source The source map or entry data
   */
  reset (source?: ConstructorParameters<typeof Map<K, T>>[0]): void {
    super.clear()

    if (source) for (const [key, value] of source) super.set(key, value)

    this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition
  }

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
 * Proxy a map to hand out a new reference whenever its contents change
 * @param map The map
 * @returns   The proxied map
 */
function proxyMap<T extends StatefulMap<any, any>> (map: T): T {
  /** Prototype methods are cached so that repeat accesses remain reference-equal */
  const methods = new Map<PropertyKey, (...args: any[]) => any>()

  const proxy: T = new Proxy(map, {
    get (target, prop) {
      const cached = methods.get(prop)
      if (cached) return cached

      // The target is the receiver because a proxy lacks the internal slots that accessors like `size` need
      const value: unknown = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value

      const method = (...args: any[]): any => {
        const returned: unknown = Reflect.apply(value as (...a: any[]) => any, target, args)

        return returned === target ? proxy : returned // Chainable mutators return the instance
      }

      if (!Object.hasOwn(target, prop)) methods.set(prop, method) // Own properties (like `forceUpdate`) can be reassigned

      return method
    }
  })

  return proxy
}

/**
 * Create a clone of a map that updates on mutation
 * Every mutation hands back a new reference, so the map can be listed directly in hook dependencies
 * To mutate without listening for changes (such as within a memoized callback), depend on `map.writer`
 * @param source The source map or entry data
 * @returns      The stateful map
 */
export function useMap<K, T> (source?: ConstructorParameters<typeof Map<K, T>>[0]): StatefulMap<K, T> {
  const revoked = useRef(false)
  const [signal, setSignal] = useState(0)

  const [map] = useState(() => new StatefulMap<K, T>(source))
  const update = useCallback(() => revoked.current ? undefined : setSignal((prior) => prior + 1), [])
  map.forceUpdate = update

  const proxy = useMemo(() => proxyMap(map), [map, signal])

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return proxy
}

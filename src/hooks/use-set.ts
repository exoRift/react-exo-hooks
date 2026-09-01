import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

/**
 * A set that rerenders on changes
 * @note All calls to forceUpdate are nullishly coalesced
 * @note because cloning methods will attempt to apply the overrides to vanilla instances
 */
export class StatefulSet<T> extends Set<T> {
  /** Force an update to register on the set */
  forceUpdate: () => void = () => {}

  /**
   * A constant reference to the underlying set
   * @note Mutating through this reference still triggers updates, but the reference never changes,
   * @note so it can be listed as a hook dependency without invalidating memos on every write
   * @returns The underlying set
   */
  get writer (): this {
    return this
  }

  /**
   * Replace the contents of the set in-place, preserving the reference
   * @param source The source set or entry data
   */
  reset (source?: ConstructorParameters<typeof Set<T>>[0]): void {
    super.clear()

    if (source) for (const value of source) super.add(value)

    this.forceUpdate?.() // eslint-disable-line @typescript-eslint/no-unnecessary-condition
  }

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
      return true
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
 * Proxy a set to hand out a new reference whenever its contents change
 * @param set The set
 * @returns   The proxied set
 */
function proxySet<T extends StatefulSet<any>> (set: T): T {
  /** Prototype methods are cached so that repeat accesses remain reference-equal */
  const methods = new Map<PropertyKey, (...args: any[]) => any>()

  const proxy: T = new Proxy(set, {
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
 * Create a clone of a set that updates on mutation
 * Every mutation hands back a new reference, so the set can be listed directly in hook dependencies
 * To mutate without listening for changes (such as within a memoized callback), depend on `set.writer`
 * @param source The source set or entry data
 * @returns      The stateful set
 */
export function useSet<T> (source?: ConstructorParameters<typeof Set<T>>[0]): StatefulSet<T> {
  const revoked = useRef(false)
  const [signal, setSignal] = useState(0)

  const [set] = useState(() => new StatefulSet<T>(source))
  const update = useCallback(() => revoked.current ? undefined : setSignal((prior) => prior + 1), [])
  set.forceUpdate = update

  const proxy = useMemo(() => proxySet(set), [set, signal])

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return proxy
}

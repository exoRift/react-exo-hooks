import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

const SET_MUTATORS = new Set<string>([
  'add',
  'delete',
  'clear'
]/*  satisfies Array<keyof Set<any>> */)

/**
 * A set that rerenders on changes
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
      this.forceUpdate()
      return false
    } else {
      super.add(value)
      this.forceUpdate()
      return false
    }
  }
}

/**
 * Proxy a set for updates
 * @param set    The set
 * @param update The update callback
 * @returns      The proxied set
 */
function proxySet<T extends Set<any>> (set: T, update: () => void): T {
  const proxy = new Proxy(set, {
    get (target, prop, receiver) {
      const value: any = Reflect.get(target, prop, receiver)

      if (typeof prop === 'string' && SET_MUTATORS.has(prop)) {
        return (...args: unknown[]) => {
          switch (prop) {
            case 'add': {
              const key = args[0]

              if (!target.has(key)) update()
              break
            }
            case 'clear':
              if (target.size) update()
              break
            case 'delete':
              if (target.has(args[0])) update()
              break
          }

          const ret = value.apply(target, args)
          return ret === set
            ? proxy
            : ret
        }
      } else if (typeof value === 'function') return value.bind(target)
      else return value
    },

    set (target, prop, value, receiver) {
      const oldValue = Reflect.get(target, prop, receiver)

      if (value !== oldValue) update()

      return Reflect.set(target, prop, value, receiver)
    }
  })

  return proxy
}

/**
 * Create a clone of a set that updates on mutation
 * @param source The source set or entry data
 * @returns      The stateful set
 */
export function useSet<T> (source?: ConstructorParameters<typeof Set<T>>[0]): StatefulSet<T> {
  const revoked = useRef(false)
  const [signal, setSignal] = useState(0)

  const [map, _setMap] = useState(new StatefulSet(source))
  const setMap = useCallback((source: ConstructorParameters<typeof Set<T>>[0]) => _setMap(new StatefulSet(source)), [])
  const update = useCallback(() => revoked.current ? undefined : setSignal((prior) => prior + 1), [])
  map.forceUpdate = update
  map.reset = setMap

  const proxy = useMemo(() => proxySet(map, update), [map, signal])

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return proxy
}

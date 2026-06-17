import { useState, useMemo, useCallback, useRef, useEffect } from 'react'

const MAP_MUTATORS = new Set<string>([
  'set',
  'delete',
  'clear',
  'getOrInsert',
  'getOrInsertComputed'
]/*  satisfies Array<keyof Map<any, any>> */)

/**
 * A map that rerenders on changes
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

    if (wasUpdated) this.forceUpdate()
    return this
  }
}

/**
 * Proxy a map for updates
 * @param map    The map
 * @param update The update callback
 * @returns      The proxied map
 */
function proxyMap<T extends Map<any, any>> (map: T, update: () => void): T {
  const proxy = new Proxy(map, {
    get (target, prop, receiver) {
      const value: any = Reflect.get(target, prop, receiver)

      if (typeof prop === 'string' && MAP_MUTATORS.has(prop)) {
        return (...args: unknown[]) => {
          switch (prop) {
            case 'set': {
              const key = args[0]

              if (!target.has(key) || target.get(key) !== args[1]) update()
              break
            }
            case 'clear':
              if (target.size) update()
              break
            case 'getOrInsert':
            case 'getOrInsertComputed':
            case 'delete':
              if (target.has(args[0])) update()
              break
          }

          const ret = value.apply(target, args)
          return ret === map
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
 * Create a clone of a map that updates on mutation
 * @param source The source map or entry data
 * @returns      The stateful map
 */
export function useMap<K, T> (source?: ConstructorParameters<typeof Map<K, T>>[0]): StatefulMap<K, T> {
  const revoked = useRef(false)
  const [signal, setSignal] = useState(0)

  const [map, _setMap] = useState(new StatefulMap(source))
  const setMap = useCallback((source: ConstructorParameters<typeof Map<K, T>>[0]) => _setMap(new StatefulMap(source)), [])
  const update = useCallback(() => revoked.current ? undefined : setSignal((prior) => prior + 1), [])
  map.forceUpdate = update
  map.reset = setMap

  const proxy = useMemo(() => proxyMap(map, update), [map, signal])

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return proxy
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const OG_OBJECT_LOOKUP = new WeakMap()
const ARRAY_MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin'
])

/**
 * Check if a value is a plain object
 * @param value The value
 * @returns     true if a plain object
 */
function isPlainObject (value: unknown): value is object {
  return (
    typeof value === 'object' &&
    value !== null &&
    (
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === Proxy.prototype
    )
  )
}

/**
 * Transform a value into its proxied variant, if available
 * @param value         The value
 * @param update        The update function for mutations
 * @param objectTracker A set to keep track of transformed objects to prevent infinite recursions
 * @returns             The proxied variant (or the original value if unproxyable)
 */
function transformValue<T> (value: T, update: () => void, objectTracker: WeakMap<any, any>): T {
  if (typeof value !== 'object' || value === null) return value

  const original = OG_OBJECT_LOOKUP.get(value)
  if (original) value = original

  const existing = objectTracker.get(value)
  if (existing) return existing

  if (isPlainObject(value)) return proxyObject(value, update, objectTracker)
  if (Array.isArray(value)) return proxyArray(value, update, objectTracker) as T

  return value
}

/**
 * Convert an array to be a StatefulArray
 * @warn Mutates the original array
 * @param arr           The original array
 * @param update        The update callback
 * @param objectTracker A set to keep track of transformed objects to prevent infinite recursions
 * @returns             The stateful array
 */
function proxyArray<T> (arr: T[], update: () => void, objectTracker: WeakMap<any, any>): T[] {
  const original = OG_OBJECT_LOOKUP.get(arr)
  if (original) arr = original
  const existing = objectTracker.get(arr)
  if (existing) return existing

  let active = false
  const proxy = new Proxy(arr, {
    get (target, prop, receiver) {
      if (!active) return Reflect.get(target, prop, receiver)
      const value = Reflect.get(target, prop, receiver)

      if (typeof prop === 'string' && ARRAY_MUTATORS.has(prop)) {
        return (...args: unknown[]) => {
          let transformedArgs = args

          if (prop === 'push' || prop === 'unshift') {
            transformedArgs = args.map((v) => transformValue(v, update, objectTracker))
          } else if (prop === 'splice' && args.length > 2) {
            transformedArgs = [
              args[0],
              args[1],
              ...args.slice(2).map((v) => transformValue(v, update, objectTracker))
            ]
          } else if (prop === 'fill' && args.length > 0) {
            transformedArgs = [
              transformValue(args[0], update, objectTracker),
              args[1],
              args[2]
            ]
          }

          const result = value.apply(target, transformedArgs)

          update()

          return result
        }
      }

      return value
    },

    set (target, prop, value, receiver) {
      if (!active) return Reflect.set(target, prop, value, receiver)

      const oldValue = Reflect.get(target, prop, receiver)
      const transformed = transformValue(value, update, objectTracker)

      if (transformed !== oldValue) update()

      return Reflect.set(target, prop, transformed, receiver)
    }
  })

  OG_OBJECT_LOOKUP.set(proxy, arr)
  objectTracker.set(arr, proxy)

  for (let i = 0; i < arr.length; ++i) {
    const element = proxy[i]
    const transformed = transformValue(element, update, objectTracker)

    proxy[i] = transformed as any
  }

  active = true

  return proxy
}

/**
 * Proxy an object recursively
 * @param object        The object
 * @param update        The function that updates the signal
 * @param objectTracker A set to keep track of transformed objects to prevent infinite recursions
 * @returns             [The proxied object, a revocation function]
 */
function proxyObject<T extends object> (object: T, update: () => void, objectTracker: WeakMap<any, any>): T {
  const original = OG_OBJECT_LOOKUP.get(object)
  if (original) object = original
  const existing = objectTracker.get(object)
  if (existing) return existing

  let active = false
  const proxy = new Proxy(object, {
    set (target, prop, newValue, receiver) {
      if (!active || prop === 'valueOf') return Reflect.set(target, prop, newValue, receiver)

      const transformedValue = transformValue(newValue, update, objectTracker)

      if (target[prop as keyof typeof target] !== transformedValue) update()

      return Reflect.set(target, prop, transformedValue, receiver)
    },

    deleteProperty (target, prop) {
      if (!active) return Reflect.deleteProperty(target, prop)

      if (prop in target) update()

      return Reflect.deleteProperty(target, prop)
    }
  })

  OG_OBJECT_LOOKUP.set(proxy, object)
  objectTracker.set(object, proxy)

  for (const key in object) {
    const oldValue = object[key as keyof typeof object]
    const transformed = transformValue(oldValue, update, objectTracker)

    object[key as keyof typeof object] = transformed as any
  }

  active = true

  return proxy
}

/**
 * Create a proxy object that updates on mutation.\
 * Changes to this object and its children will affect the original.\
 * This also applies to arrays.\
 * This hook is recursive into simple object properties. Class instances will remain unaffected
 * @note Effects and memos that use this object should also listen for its signal: `+INSTANCE`
 * @param initial The initial object
 * @returns       [object, setObject, forceUpdate]
 */
export function useObject<T extends object> (initial: T): [object: T, setObject: React.Dispatch<React.SetStateAction<T>>, forceUpdate: () => void] {
  const revoked = useRef(false)
  /** Keep track of transformed objects to prevent infinite recursions */
  const objectTracker = useRef(new WeakMap())

  const [signal, setSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const proxy = useMemo(() => proxyObject(object, () => revoked.current ? undefined : setSignal((prior) => prior + 1), objectTracker.current), [object, setSignal])

  const forceUpdate = useCallback(() =>
    setSignal((prior) => prior + 1)
  , [])

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  proxy.valueOf = () => signal
  return [proxy, setObject, forceUpdate]
}

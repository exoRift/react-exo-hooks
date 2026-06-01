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
          const result = value.apply(target, args)

          update()

          return result
        }
      }

      return value
    },

    set (target, prop, value, receiver) {
      if (!active) return Reflect.set(target, prop, value, receiver)

      const oldValue = Reflect.get(target, prop, receiver)
      const changed = oldValue !== value

      if (changed) update()

      return Reflect.set(target, prop, value, receiver)
    }
  })

  OG_OBJECT_LOOKUP.set(proxy, arr)
  objectTracker.set(arr, proxy)

  for (let i = 0; i < arr.length; ++i) {
    const element = proxy[i]
    if (isPlainObject(element)) proxy[i] = proxyObject(element, update, objectTracker)
    else if (Array.isArray(element)) proxy[i] = proxyArray(element, update, objectTracker) as any
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
      if (!active) return Reflect.set(target, prop, newValue, receiver)

      if (objectTracker.has(newValue)) return Reflect.set(target, prop, newValue, receiver)

      if (prop !== 'valueOf' && target[prop as keyof typeof target] !== newValue) update()

      const isPlain = isPlainObject(newValue)
      if (isPlain) {
        const subproxy = proxyObject(newValue, update, objectTracker)

        return Reflect.set(target, prop, subproxy, receiver)
      } else if (Array.isArray(newValue)) {
        const stateful = proxyArray(newValue, update, objectTracker)

        return Reflect.set(target, prop, stateful, receiver)
      } else return Reflect.set(target, prop, newValue, receiver)
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
    const original = object[key as keyof typeof object]
    if (isPlainObject(original)) {
      const subproxy = proxyObject(original, update, objectTracker)

      object[key as keyof typeof object] = subproxy as any
    } else if (Array.isArray(original)) {
      const stateful = proxyArray(original, update, objectTracker)

      object[key as keyof typeof object] = stateful as any
    }
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatefulArray } from './use-array'

/**
 * Check if a value is a plain object
 * @param value The value
 * @returns     true if a plain object
 */
function isPlainObject (value: unknown): value is object {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
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
function proxyArray<T> (arr: T[], update: () => void, objectTracker: Set<any>): StatefulArray<T> {
  objectTracker.add(arr)

  for (let i = 0; i < arr.length; ++i) {
    const element = arr[i]
    if (objectTracker.has(element)) continue

    if (isPlainObject(element)) arr[i] = proxyObject(element, update, true, objectTracker)
    else if (Array.isArray(element)) arr[i] = proxyArray(element, update, objectTracker) as any
  }

  const stateful = new StatefulArray(arr, update)
  objectTracker.add(stateful)
  objectTracker.delete(arr)
  return stateful
}

/**
 * Proxy an object recursively
 * @param object          The object
 * @param update          The function that updates the signal
 * @param transformArrays Should we transform arrays into StatefulArrays?
 * @param objectTracker   A set to keep track of transformed objects to prevent infinite recursions
 * @returns               [The proxied object, a revocation function]
 */
function proxyObject<T extends object> (object: T, update: () => void, transformArrays: boolean, objectTracker: Set<any>): T {
  objectTracker.add(object)

  for (const key in object) {
    const original = object[key as keyof typeof object]
    if (objectTracker.has(original)) continue

    if (isPlainObject(original)) {
      const subproxy = proxyObject(original, update, transformArrays, objectTracker)

      object[key as keyof typeof object] = subproxy as any
    } else if (transformArrays && Array.isArray(original)) {
      const stateful = proxyArray(original, update, objectTracker)

      object[key as keyof typeof object] = stateful as any
    }
  }

  const proxy = new Proxy(object, {
    set (target, prop, newValue, receiver) {
      if (objectTracker.has(newValue)) return Reflect.set(target, prop, newValue, receiver)

      if (prop !== 'valueOf' && target[prop as keyof typeof target] !== newValue) update()

      const isPlain = isPlainObject(newValue)
      if (isPlain) {
        const subproxy = proxyObject(newValue, update, transformArrays, objectTracker)

        return Reflect.set(target, prop, subproxy, receiver)
      } else if (transformArrays && Array.isArray(newValue)) {
        const stateful = proxyArray(newValue, update, objectTracker)

        return Reflect.set(target, prop, stateful, receiver)
      } else return Reflect.set(target, prop, newValue, receiver)
    },

    deleteProperty (target, prop) {
      if (prop in target) update()

      return Reflect.deleteProperty(target, prop)
    }
  })

  objectTracker.delete(object)
  objectTracker.add(proxy)
  return proxy
}

/**
 * Create an object state value that auto updates on mutation \
 * This hook is recursive into simple object properties. Class instances will remain unaffected
 * @note Effects and memos that use this object should also listen for its signal: `+INSTANCE`
 * @param initial         The initial object
 * @param transformArrays Automatically transform arrays into stateful arrays on init and on property set/update.\
 *                        Stateful arrays update on mutation and are used internally by the `useArray` hook.\
 *                        Upon component unmount, revert back to vanilla arrays.\
 *                        \
 *                        WARNING: Be careful when performing `obj[PROPERTY] = arr`, where `arr` is a variable,\
 *                        since your variable will no longer reference the same array that is now present in the object\
 *                        (the same principle applies to shared references to the array properties on init)
 * @returns               [object, setObject, forceUpdate]
 */
export function useObject<T extends object> (initial: T, transformArrays = false): [object: T, setObject: React.Dispatch<React.SetStateAction<T>>, forceUpdate: () => void] {
  const revoked = useRef(false)
  /** Keep track of transformed objects to prevent infinite recursions */
  const objectTracker = useRef(new Set<any>())

  const [signal, setSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const proxy = useMemo(() => proxyObject(object, () => revoked.current ? undefined : setSignal((prior) => prior + 1), transformArrays, objectTracker.current), [object, setSignal, transformArrays])

  const forceUpdate = useCallback(() =>
    setSignal((prior) => prior + 1)
  , [])

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  proxy.valueOf = () => signal
  return [revoked.current ? object : proxy, setObject, forceUpdate]
}

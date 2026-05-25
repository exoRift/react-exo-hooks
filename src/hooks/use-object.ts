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
 * Proxy an object recursively
 * @param object          The object
 * @param update          The function that updates the signal
 * @param transformArrays Should we transform arrays into StatefulArrays?
 * @returns               [The proxied object, a revocation function]
 */
function proxyObject<T extends object> (object: T, update: () => void, transformArrays: boolean): T {
  for (const key in object) {
    const original = object[key as keyof typeof object]

    if (isPlainObject(original)) {
      const subproxy = proxyObject(original, update, transformArrays)

      object[key as keyof typeof object] = subproxy as any
    } else if (transformArrays && Array.isArray(original)) {
      const stateful = new StatefulArray(original, update)

      object[key as keyof typeof object] = stateful as any
    }
  }

  const proxy = new Proxy(object, {
    set (target, prop, newValue, receiver) {
      if (prop !== 'valueOf' && target[prop as keyof typeof target] !== newValue) update()

      const isPlain = isPlainObject(newValue)
      if (isPlain) {
        const subproxy = proxyObject(newValue, update, transformArrays)

        return Reflect.set(target, prop, subproxy, receiver)
      } else if (transformArrays && Array.isArray(newValue)) {
        const stateful = new StatefulArray(newValue, update)

        return Reflect.set(target, prop, stateful, receiver)
      } else return Reflect.set(target, prop, newValue, receiver)
    },

    deleteProperty (target, prop) {
      if (prop in target) update()

      return Reflect.deleteProperty(target, prop)
    }
  })

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

  const [signal, setSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const proxy = useMemo(() => proxyObject(object, () => revoked.current ? undefined : setSignal((prior) => prior + 1), transformArrays), [object, setSignal, transformArrays])

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

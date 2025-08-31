import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
 * @param object The object
 * @param update The function that updates the signal
 * @returns      The proxied object
 */
function proxyObject<T extends object> (object: T, update: () => void): T {
  for (const key in object) {
    const original = object[key as keyof typeof object]

    if (isPlainObject(original)) {
      const subproxy = proxyObject(original, update)

      object[key as keyof typeof object] = subproxy as any
    }
  }

  const proxy = new Proxy(object, {
    set (target, prop, newValue, receiver) {
      if (prop !== 'valueOf' && target[prop as keyof typeof target] !== newValue) update()

      const isPlain = isPlainObject(newValue)
      if (isPlain) {
        const subproxy = proxyObject(newValue, update)

        return Reflect.set(target, prop, subproxy, receiver)
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
 * @param initial The initial object
 * @returns       [object, setObject, forceUpdate]
 */
export function useObject<T extends object> (initial: T): [object: T, setObject: React.Dispatch<React.SetStateAction<T>>, forceUpdate: () => void] {
  const revoked = useRef(false)

  const [signal, setSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const proxy = useMemo(() => proxyObject(object, () => setSignal((prior) => prior + 1)), [object, setSignal])

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

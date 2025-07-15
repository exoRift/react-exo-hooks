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
 * @param object    The object
 * @param setSignal The signal dispatch fn
 * @returns         The proxied object
 */
function proxyObject<T extends object> (object: T, setSignal: React.Dispatch<React.SetStateAction<number>>): [proxy: T, revoke: () => void] {
  const revocables: Array<() => void> = []

  for (const key in object) {
    const original = object[key as keyof typeof object]
    if (isPlainObject(original)) {
      const [subproxy, subrevoke] = proxyObject(original, setSignal)
      object[key as keyof typeof object] = subproxy as any
      revocables.push(() => {
        subrevoke()
        object[key as keyof typeof object] = original
      })
    }
  }

  const proxy = Proxy.revocable(object, {
    set (target, prop, newValue) {
      if (prop !== 'valueOf' && target[prop as keyof typeof target] !== newValue) setSignal((prior) => prior + 1)
      const isPlain = isPlainObject(newValue)
      if (isPlain) {
        const [subproxy, subrevoke] = proxyObject(newValue, setSignal)
        revocables.push(() => {
          subrevoke()
          Reflect.set(target, prop, newValue)
        })
        return Reflect.set(target, prop, subproxy)
      } else return Reflect.set(target, prop, newValue)
    },

    deleteProperty (target, prop) {
      if (prop in target) setSignal((prior) => prior + 1)
      return Reflect.deleteProperty(target, prop)
    }
  })

  function revoke (): void {
    proxy.revoke()
    for (const subrevoke of revocables) subrevoke()
  }

  return [proxy.proxy, revoke]
}

/**
 * Create an object state value that auto updates on mutation \
 * This hook is recursive into simple object properties. Class instances will remain unaffected
 * @note Effects and memos that use this object should also listen for its signal: `+INSTANCE`
 * @warn You should revoke the proxy if you're done with render and don't want unforseen complications. Auto-revokes on and `setObject`
 * @param initial The initial object
 * @returns       [object, setObject, forceUpdate, revoke]
 */
export function useObject<T extends object> (initial: T): [object: T, setObject: React.Dispatch<React.SetStateAction<T>>, forceUpdate: () => void, revoke: () => void] {
  const revoked = useRef(false)

  const [signal, setSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const [proxy, _revoke] = useMemo(() => proxyObject(object, setSignal), [object])

  const forceUpdate = useCallback(() => {
    setSignal((prior) => prior + 1)
  }, [])

  const revoke = useCallback(() => {
    if (!import.meta.hot) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition
      _revoke()
      revoked.current = true
    }
  }, [_revoke])

  useEffect(() => {
    return () => revoke()
  }, [revoke])

  proxy.valueOf = () => signal
  return [revoked.current ? object : proxy, setObject, forceUpdate, revoke]
}

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Proxy an object recursively
 * @param object    The object
 * @param setSignal The signal dispatch fn
 * @returns         The proxied object
 */
function proxyObject<T extends object> (object: T, setSignal: React.Dispatch<React.SetStateAction<number>>): [proxy: T, revoke: () => void] {
  const revocables: Array<() => void> = []

  const proxy = Proxy.revocable(object, {
    set (target, prop, newValue) {
      if (prop !== 'valueOf' && target[prop as keyof typeof target] !== newValue) setSignal((prior) => prior + 1)
      const isPlain = (
        typeof object === 'object' &&
        (object as any) !== null &&
        Object.getPrototypeOf(object) === Object.prototype
      )
      if (isPlain) {
        const [subproxy, subrevoke] = proxyObject(newValue, setSignal)
        target[prop as keyof typeof target] = subproxy
        revocables.push(subrevoke)
      } else target[prop as keyof typeof target] = newValue
      return true
    },

    deleteProperty (target, prop) {
      if (prop in target) setSignal((prior) => prior + 1)
      delete target[prop as keyof typeof target]
      return true
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
  const [signal, setSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const [proxy, revoke] = useMemo(() => proxyObject(object, setSignal), [object])

  const forceUpdate = useCallback(() => {
    setSignal((prior) => prior + 1)
  }, [])

  useEffect(() => {
    return () => revoke()
  }, [revoke])

  proxy.valueOf = () => signal
  return [proxy, setObject, forceUpdate, revoke]
}

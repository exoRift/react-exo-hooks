import { useCallback, useMemo, useState } from 'react'

/**
 * Create an object state value that auto updates on mutation
 * @note Effects and memos that use this object should also listen for its signal: `+INSTANCE`
 * @param initial The initial object
 * @returns       [object, setObject, forceUpdate]
 */
export function useObject<T extends object> (initial: T): [object: T, setObject: React.Dispatch<React.SetStateAction<T>>, forceUpdate: () => void] {
  const [signal, setSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const proxy = useMemo(() => new Proxy(object, {
    set (target, prop, newValue) {
      if (prop !== 'valueOf' && target[prop as keyof typeof target] !== newValue) setSignal((prior) => prior + 1)
      target[prop as keyof typeof target] = newValue
      return true
    },

    deleteProperty (target, prop) {
      if (prop in target) setSignal((prior) => prior + 1)
      delete target[prop as keyof typeof target]
      return true
    }
  }), [object])

  const forceUpdate = useCallback(() => {
    setSignal((prior) => prior + 1)
  }, [])

  proxy.valueOf = () => signal
  return [proxy, setObject, forceUpdate]
}

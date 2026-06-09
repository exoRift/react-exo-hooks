import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** A map to get the original object from a proxy */
const OG_OBJECT_LOOKUP = new Map()
/** A map to keep track of object signals for individual object state evaluation */
const OBJECT_SIGNALS = new Map<any, number>()

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
 * Check if a value is a proxyable object
 * @param value The value
 * @returns     true if value is a proxyable object
 */
function isProxyableObject (value: unknown): value is object {
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
 * @param value            The value
 * @param update           The update function for mutations
 * @param objectTracker    A map to keep track of transformed objects to prevent infinite recursions
 * @param ignoreProperties A list of property keys to ignore when generating proxies / listening for changes
 * @returns                The proxied variant (or the original value if unproxyable)
 */
function transformValue<T> (value: T, update: (obj: any) => void, objectTracker: Map<any, any>, ignoreProperties: Set<string | symbol>): T {
  if (typeof value !== 'object' || value === null) return value

  if (Array.isArray(value)) return proxyArray(value, update, objectTracker, ignoreProperties) as T
  else if (isProxyableObject(value)) return proxyObject(value, update, objectTracker, ignoreProperties)

  return value
}

/**
 * Convert an array to be a StatefulArray
 * @warn Mutates the original array
 * @param arr              The original array
 * @param update           The update callback
 * @param objectTracker    A map to keep track of transformed objects to prevent infinite recursions
 * @param ignoreProperties A list of property keys to ignore when generating proxies / listening for changes
 * @returns                The stateful array
 */
function proxyArray<T> (arr: T[], update: (obj: any) => void, objectTracker: Map<any, any>, ignoreProperties: Set<string | symbol>): T[] {
  const original = OG_OBJECT_LOOKUP.get(arr)
  if (original) arr = original
  const existing = objectTracker.get(arr)
  if (existing) return existing

  const valueOf = (): number => OBJECT_SIGNALS.get(proxy) ?? NaN
  const subUpdate = (subObj: any): void => { update(proxy); update(subObj) }

  const proxy = new Proxy(arr, {
    get (target, prop, receiver) {
      if (prop === 'valueOf' || prop === Symbol.toPrimitive) return valueOf

      const value = Reflect.get(target, prop, receiver)

      if (typeof prop === 'string' && ARRAY_MUTATORS.has(prop)) {
        return (...args: unknown[]) => {
          let transformedArgs = args

          if (prop === 'push' || prop === 'unshift') {
            transformedArgs = args.map((v) => transformValue(v, subUpdate, objectTracker, ignoreProperties))
          } else if (prop === 'splice' && args.length > 2) {
            transformedArgs = [
              args[0],
              args[1],
              ...args.slice(2).map((v) => transformValue(v, subUpdate, objectTracker, ignoreProperties))
            ]
          } else if (prop === 'fill' && args.length > 0) {
            transformedArgs = [
              transformValue(args[0], subUpdate, objectTracker, ignoreProperties),
              args[1],
              args[2]
            ]
          }

          const result = value.apply(target, transformedArgs)

          update(proxy)

          return result
        }
      } else if (typeof prop === 'string' && !isNaN(Number(prop))) return transformValue(value, subUpdate, objectTracker, ignoreProperties)
      else return value
    },

    set (target, prop, value, receiver) {
      const oldValue = Reflect.get(target, prop, receiver)
      const transformed = transformValue(value, subUpdate, objectTracker, ignoreProperties)

      if (transformed !== oldValue) update(proxy)

      return Reflect.set(target, prop, transformed, receiver)
    }
  })

  OG_OBJECT_LOOKUP.set(proxy, arr)
  objectTracker.set(arr, proxy)

  OBJECT_SIGNALS.set(proxy, 0)

  return proxy
}

/**
 * Proxy an object recursively
 * @param object           The object
 * @param update           The function that updates the signal
 * @param objectTracker    A map to keep track of transformed objects to prevent infinite recursions
 * @param ignoreProperties A list of property keys to ignore when generating proxies / listening for changes
 * @returns                [The proxied object, a revocation function]
 */
function proxyObject<T extends object> (object: T, update: (obj: any) => void, objectTracker: Map<any, any>, ignoreProperties: Set<string | symbol>): T {
  const original = OG_OBJECT_LOOKUP.get(object)
  if (original) object = original
  const existing = objectTracker.get(object)
  if (existing) return existing

  const valueOf = (): number => OBJECT_SIGNALS.get(proxy) ?? NaN
  const subUpdate = (subObj: any): void => { update(proxy); update(subObj) }

  const proxy = new Proxy(object, {
    get (target, prop, receiver) {
      if (prop === 'valueOf' || prop === Symbol.toPrimitive) return valueOf

      const value = Reflect.get(target, prop, receiver)

      if (!ignoreProperties.has(prop)) return transformValue(value, subUpdate, objectTracker, ignoreProperties)
      else return value
    },

    set (target, prop, newValue, receiver) {
      if (prop === 'valueOf' || ignoreProperties.has(prop)) return Reflect.set(target, prop, newValue, receiver)

      const transformedValue = ignoreProperties.has(prop)
        ? newValue
        : transformValue(newValue, subUpdate, objectTracker, ignoreProperties)

      if (target[prop as keyof typeof target] !== transformedValue) update(proxy)

      return Reflect.set(target, prop, transformedValue, receiver)
    },

    deleteProperty (target, prop) {
      if (prop in target && !ignoreProperties.has(prop)) update(proxy)

      return Reflect.deleteProperty(target, prop)
    }
  })

  OG_OBJECT_LOOKUP.set(proxy, object)
  objectTracker.set(object, proxy)

  OBJECT_SIGNALS.set(proxy, 0)

  return proxy
}

/**
 * Create a proxy object that updates on mutation.\
 * Changes to this object and its children will affect the original.\
 * This also applies to arrays.\
 * This hook is recursive into simple object properties. Class instances will remain unaffected
 * @note Effects and memos that use this object should also listen for its signal: `+INSTANCE`.\
 * You can call +obj on this object or any nested object/array\
 * (Example: `+root - +root.prop` will listen for changes to `root` while ignoring changes to `root.prop`)
 * @param initial          The initial object
 * @param ignoreProperties A list of property keys to ignore when generating proxies / listening for changes
 * @returns                [object, setObject, forceUpdate]
 */
export function useObject<T extends object> (initial: T, ignoreProperties?: Array<string | symbol>): [
  /** The object, deeply proxied. Any generic object or array property can have its update signal gotten with +obj */
  object: T,
  /** Set the root object value to some new object */
  setObject: React.Dispatch<React.SetStateAction<T>>,
  /** Force the root object to undergo a state increment for rerender */
  forceUpdate: () => void
] {
  const revoked = useRef(false)
  /** A map to keep track of transformed objects to prevent infinite recursions */
  const objectTracker = useRef(new Map())

  const [_, setGeneralSignal] = useState(0)
  const [object, setObject] = useState(initial)

  const submitUpdate = useCallback((obj: any) => {
    const oldSignal = OBJECT_SIGNALS.get(obj)
    if (oldSignal !== undefined) OBJECT_SIGNALS.set(obj, oldSignal + 1)
    setGeneralSignal((prior) => prior + 1)
  }, [])

  const proxy = useMemo(() => transformValue(object, (obj: any) => revoked.current ? undefined : submitUpdate(obj), objectTracker.current, new Set(ignoreProperties)), [object])

  const forceUpdate = useCallback(() =>
    setGeneralSignal((prior) => prior + 1)
  , [])

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return [proxy, setObject, forceUpdate]
}

/**
 * Get an unproxied object, deeply unproxying all properties
 * @param obj The object to unproxy
 * @returns   The unproxied object
 */
export function getUnproxiedObject<T> (obj: T): T {
  return OG_OBJECT_LOOKUP.get(obj) ?? obj
}

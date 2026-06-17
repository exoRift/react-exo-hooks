import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** A map to get the original object from a proxy */
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

  const original = OG_OBJECT_LOOKUP.get(value)
  if (original) value = original
  const existing = objectTracker.get(value)
  if (existing) return existing

  let proxy

  if (Array.isArray(value)) proxy = proxyArray(value, update, objectTracker, ignoreProperties) as T
  else if (isProxyableObject(value)) proxy = proxyObject(value, update, objectTracker, ignoreProperties)
  else return value

  OG_OBJECT_LOOKUP.set(proxy as object, value)
  objectTracker.set(value, proxy)

  return proxy
}

/**
 * Proxy an array recursively for updates
 * @param arr              The original array
 * @param update           The update callback
 * @param objectTracker    A map to keep track of transformed objects to prevent infinite recursions
 * @param ignoreProperties A list of property keys to ignore when generating proxies / listening for changes
 * @returns                The stateful array
 */
function proxyArray<T> (arr: T[], update: (obj: any) => void, objectTracker: Map<any, any>, ignoreProperties: Set<string | symbol>): T[] {
  const subUpdate = (subObj: any): void => { update(proxy); update(subObj) }

  const proxy = new Proxy(arr, {
    get (target, prop, receiver) {
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

          const result = value.apply(receiver, transformedArgs)

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

  return proxy
}

/**
 * Proxy an object recursively for updates
 * @param object           The object
 * @param update           The function that updates the signal
 * @param objectTracker    A map to keep track of transformed objects to prevent infinite recursions
 * @param ignoreProperties A list of property keys to ignore when generating proxies / listening for changes
 * @returns                [The proxied object, a revocation function]
 */
function proxyObject<T extends object> (object: T, update: (obj: any) => void, objectTracker: Map<any, any>, ignoreProperties: Set<string | symbol>): T {
  const subUpdate = (subObj: any): void => { update(proxy); update(subObj) }

  const proxy = new Proxy(object, {
    get (target, prop, receiver) {
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

  return proxy
}

/**
 * Create a proxy object that updates on mutation.\
 * Changes to this object and its children will affect the original.\
 * This also applies to arrays.\
 * This hook is recursive into simple object properties. Class instances will remain unaffected \
 * You can listen for changes on this object in hooks dependencies or any nested object/array
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
  /** A map to keep track of transformed objects to prevent infinite recursions */
  const objectTracker = useRef(new Map())
  const revoked = useRef(false)

  const [_object, _setObject] = useState(initial)
  const [, setSignal] = useState(0)

  const forceUpdate = useCallback(() => {
    if (revoked.current) return
    objectTracker.current.clear()
    setSignal((prior) => prior + 1)
  }, [])
  const setObject = useCallback<typeof _setObject>((val) => {
    forceUpdate()
    _setObject(val)
  }, [forceUpdate])
  const deleteEntry = useCallback((obj: any) => {
    if (revoked.current) return
    objectTracker.current.delete(OG_OBJECT_LOOKUP.get(obj))
    setSignal((prior) => prior + 1)
  }, [])
  const ignorePropertiesSet = useMemo(() => new Set(ignoreProperties), [ignoreProperties])

  const object = transformValue(
    _object,
    deleteEntry,
    objectTracker.current,
    ignorePropertiesSet
  )

  useEffect(() => {
    revoked.current = false
    return () => { revoked.current = true }
  }, [])

  return [object, setObject, forceUpdate]
}

/**
 * Get an unproxied object (copy), deeply unproxying all properties
 * @param obj           The object to unproxy
 * @param objectTracker A map to track already-unproxied objects
 * @returns             The unproxied object
 */
function _getUnproxiedObject<T extends object> (obj: T, objectTracker: Map<any, any>): T {
  if (objectTracker.has(obj)) return objectTracker.get(obj)
  let og = OG_OBJECT_LOOKUP.get(obj) ?? obj
  objectTracker.set(obj, og)

  if (Array.isArray(og)) og = og.map((v) => _getUnproxiedObject(v, objectTracker))
  else if (isProxyableObject(og)) {
    const replacement: Record<any, any> = {}

    for (const key in og) replacement[key] = _getUnproxiedObject(og[key as keyof typeof og], objectTracker)

    og = replacement
  }

  return og
}

/**
 * Get an unproxied object (copy), deeply unproxying all properties
 * @param obj The object to unproxy
 * @returns   The unproxied object
 */
export function getUnproxiedObject<T extends object> (obj: T): T {
  const objectTracker = new Map()
  return _getUnproxiedObject(obj, objectTracker)
}

import { type SetStateAction, useState, useEffect } from 'react'

/**
 * This is a set that causes rerenders on updates
 * @note Effects and memos that use this set should also listen for its signal: `+INSTANCE`
 */
export class StatefulMap<K, T> extends Map<K, T> {
  /** The dispatch function for the signal */
  private readonly _dispatchSignal?: React.Dispatch<SetStateAction<number>>
  /** The update signal */
  private _signal: number
  /** THe dispatch function for redefining the set */
  private _dispatchRedefine?: React.Dispatch<SetStateAction<StatefulMap<K, T>>>

  /**
   * Construct a StatefulSet
   * @param initial        The initial value (parameter for a vanilla set)
   * @param dispatchSignal The dispatch function for the signal
   */
  constructor (initial?: Map<K, T> | Array<[K, T]>, dispatchSignal?: StatefulMap<K, T>['_dispatchSignal']) {
    super(initial)
    this._signal = 0
    this._dispatchSignal = dispatchSignal
  }

  /**
   * Set the redefine dispatch
   * @private
   * @param callback The function
   */
  _setRedefine (callback: StatefulMap<K, T>['_dispatchRedefine']): void {
    this._dispatchRedefine = callback
  }

  /**
   * Force a signal update
   */
  forceUpdate (): void {
    this._dispatchSignal?.(++this._signal)
  }

  /**
   * Set the instance to an entirely new instance
   * @param           value The new instance
   * @returns               The new instance
   * @throws  {Error}       If no redefinition callback is defined
   */
  reset (value: Map<K, T>): Map<K, T> {
    if (!this._dispatchRedefine) throw new Error('Cannot redefine Set. No redefine callback set.')
    const instance = new StatefulMap(value, this._dispatchSignal)
    instance._signal = this._signal

    this._dispatchRedefine(instance)
    instance._dispatchSignal?.(++instance._signal)

    return instance
  }

  /**
   * @override
   */
  override set (key: K, value: T): this {
    const old = super.get(key)
    const newKey = !this.has(key)
    super.set(key, value)
    if (newKey || old !== value) this._dispatchSignal?.(++this._signal)
    return this
  }

  /**
   * Bulk set an array of items
   * @note Always rerenders
   * @param items An array of items
   * @param keyFn Either the name of a property of each item or a function that returns the key for each item
   * @returns     this
   */
  bulkSet<U extends K & keyof T> (items: T[], keyFn: U | ((i: T) => U)): this {
    for (const item of items) {
      const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn]

      super.set(key as K, item)
    }
    this._dispatchSignal?.(++this._signal)

    return this
  }

  /**
   * @override
   */
  override delete (key: K): boolean {
    const returnValue = super.delete(key)
    if (returnValue) this._dispatchSignal?.(++this._signal)
    return returnValue
  }

  /**
   * @override
   */
  override clear (): void {
    super.clear()
    this._dispatchSignal?.(this._signal = 0)
  }

  /**
   * Returns the set's signal. Used for effects and memos that use this set
   * @returns The numeric signal
   */
  override valueOf (): number {
    return this._signal
  }
}

/**
 * Use a stately set
 * @note Any effects or memos that use this set should also listen for its signal (`+INSTANCE`)
 * @param initial The initial set value
 * @returns       The stately set
 */
export function useMap<K, T> (initial?: Map<K, T> | Array<[K, T]>): StatefulMap<K, T> {
  const [, setSignal] = useState(Array.isArray(initial) ? initial.length : initial?.size ?? 0)
  const [map, setMap] = useState(new StatefulMap(initial, setSignal))

  useEffect(() => map._setRedefine(setMap), [map])

  return map
}

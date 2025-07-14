import { type SetStateAction, useState, useEffect } from 'react'

/**
 * This is an array that causes rerenders on updates
 * @note Effects and memos that use this array should also listen for its signal: `+INSTANCE`
 */
export class StatefulArray<T> extends Array<T> {
  /** The dispatch function for the signal */
  private readonly _dispatchSignal?: React.Dispatch<SetStateAction<number>>
  /** The update signal */
  private _signal: number
  /** THe dispatch function for redefining the set */
  private _dispatchRedefine?: React.Dispatch<SetStateAction<StatefulArray<T>>>

  /**
   * Construct a StatefulSet
   * @param initial        The initial value (parameter for a vanilla set)
   * @param dispatchSignal The dispatch function for the signal
   */
  constructor (initial?: Iterable<T>, dispatchSignal?: StatefulArray<T>['_dispatchSignal']) {
    if (initial) super(...initial)
    else super()
    this._signal = 0
    this._dispatchSignal = dispatchSignal
  }

  /**
   * Set the redefine dispatch
   * @private
   * @param callback The function
   */
  _setRedefine (callback: StatefulArray<T>['_dispatchRedefine']): void {
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
   * @throws  {Error}       If there's no redefinition callback defined
   */
  reset (value: Iterable<T>): Iterable<T> {
    if (!this._dispatchRedefine) throw new Error('Cannot redefine Array. No redefine callback set.')
    const instance = new StatefulArray(value, this._dispatchSignal)
    if (this._signal === 0) instance._signal = 1 // Force update

    this._dispatchRedefine(instance)
    instance._dispatchSignal?.(instance._signal)

    return instance
  }

  /**
   * @override
   */
  override copyWithin (target: number, start: number, end?: number): this {
    let different = false
    for (let offset = 0; offset < (end ?? this.length - 1); ++offset) {
      if (this[target + offset] !== this[start + offset]) {
        different = true
        break
      }
    }

    if (different) this._dispatchSignal?.(++this._signal)
    return super.copyWithin(target, start, end)
  }

  /**
   * @override
   */
  override fill (value: T, start?: number, end?: number): this {
    let different = false
    for (let i = start ?? 0; i < (end ?? this.length - 1); ++i) {
      if (this[i] !== value) {
        different = true
        break
      }
    }

    if (different) this._dispatchSignal?.(++this._signal)
    return super.fill(value, start, end)
  }

  /**
   * @override
   */
  override pop (): T | undefined {
    if (this.length) this._dispatchSignal?.(++this._signal)
    return super.pop()
  }

  /**
   * @override
   */
  override push (...items: T[]): number {
    if (items.length) this._dispatchSignal?.(++this._signal)
    return super.push(...items)
  }

  /**
   * @override
   */
  override reverse (): T[] {
    let palindrome = true
    for (let i = 0; i < Math.floor(this.length / 2); ++i) {
      if (this[i] !== this[this.length - i - 1]) {
        palindrome = false
        break
      }
    }

    if (!palindrome) this._dispatchSignal?.(++this._signal)
    return super.reverse()
  }

  /**
   * @override
   */
  override shift (): T | undefined {
    if (this.length) this._dispatchSignal?.(++this._signal)
    return super.shift()
  }

  /**
   * @override
   */
  override sort (compareFn?: ((a: T, b: T) => number)): this {
    // No way to efficiently compare this without copying; always signal
    this._dispatchSignal?.(++this._signal)
    return this.sort(compareFn)
  }

  /**
   * @override
   * @overload
   */
  override splice (start: number, deleteCount?: number): T[]
  /**
   * @override
   */
  override splice (start: number, deleteCount: number, ...rest: T[]): T[] {
    if (deleteCount || rest.length) this._dispatchSignal?.(++this._signal)
    return super.splice(start, deleteCount, ...rest)
  }

  /**
   * @override
   */
  override unshift (...items: T[]): number {
    if (items.length) this._dispatchSignal?.(++this._signal)
    return super.unshift(...items)
  }

  /**
   * Returns the set's signal. Used for effects and memos that use this set
   * @returns A numeric signal
   */
  override valueOf (): number {
    return this._signal
  }
}

/**
 * Use a stately array
 * @note Any effects or memos that use this set should also listen for its signal (`+INSTANCE`)
 * @param initial The initial array value
 * @returns       The stately array
 */
export function useArray<T> (initial?: Iterable<T>): StatefulArray<T> {
  const [, setSignal] = useState(0)
  const [array, setArray] = useState(new StatefulArray(initial, setSignal))

  useEffect(() => array._setRedefine(setArray), [array])

  return array
}

import { type SetStateAction, useState, useEffect } from 'react'

/**
 * This is a set that causes rerenders on updates
 * @note Effects and memos that use this set should also listen for its signal: `+INSTANCE`
 */
export class StatefulSet<T> extends Set<T> {
  /** The dispatch function for the signal */
  private readonly _dispatchSignal?: React.Dispatch<SetStateAction<number>>
  /** THe dispatch function for redefining the set */
  private _dispatchRedefine?: React.Dispatch<SetStateAction<StatefulSet<T>>>

  /**
   * Construct a StatefulSet
   * @param initial        The initial value (parameter for a vanilla set)
   * @param dispatchSignal The dispatch function for the signal
   */
  constructor (initial?: Iterable<T>, dispatchSignal?: StatefulSet<T>['_dispatchSignal']) {
    super(initial)
    this._dispatchSignal = dispatchSignal
  }

  /**
   * Set the redefine dispatch
   * @private
   * @param callback The function
   */
  _setRedefine (callback: StatefulSet<T>['_dispatchRedefine']): void {
    this._dispatchRedefine = callback
  }

  /**
   * Force a signal update
   */
  forceUpdate (): void {
    this._dispatchSignal?.(-1)
  }

  /**
   * Set the instance to an entirely new instance
   * @param           value The new instance
   * @returns               The new instance
   * @throws  {Error}       If there's no redefinition callback defined
   */
  reset (value: Iterable<T>): Iterable<T> {
    if (!this._dispatchRedefine) throw new Error('Cannot redefine Set. No redefine callback set.')
    const instance = new StatefulSet(value, this._dispatchSignal)

    this._dispatchRedefine(instance)
    instance._dispatchSignal?.(instance.size)

    return instance
  }

  /**
   * @override
   */
  override add (value: T): this {
    super.add(value)
    this._dispatchSignal?.(super.size)
    return this
  }

  /**
   * @override
   */
  override delete (value: T): boolean {
    const returnValue = super.delete(value)
    this._dispatchSignal?.(super.size)
    return returnValue
  }

  /**
   * @override
   */
  override clear (): void {
    super.clear()
    this._dispatchSignal?.(super.size)
  }

  /**
   * Toggle if an element is present within the set
   * @note This is a custom set method
   * @param value The value to toggle
   * @returns     The new state: true if the value is now in the set, false if the value is now not in the set
   */
  toggle (value: T): boolean {
    if (super.has(value)) {
      super.delete(value)
      this._dispatchSignal?.(super.size)
      return false
    } else {
      super.add(value)
      this._dispatchSignal?.(super.size)
      return false
    }
  }

  /**
   * Returns the set's signal. Used for effects and memos that use this set
   * @returns A numeric signal
   */
  override valueOf (): number {
    return this.size
  }
}

/**
 * Use a stately set
 * @note Any effects or memos that use this set should also listen for its signal (`+INSTANCE`)
 * @param initial The initial set value
 * @returns       The stately set
 */
export function useSet<T> (initial?: Set<T> | T[]): StatefulSet<T> {
  const [, setSignal] = useState(Array.isArray(initial) ? initial.length : initial?.size ?? 0)
  const [set, setSet] = useState(new StatefulSet(initial, setSignal))

  useEffect(() => set._setRedefine(setSet), [set])

  return set
}

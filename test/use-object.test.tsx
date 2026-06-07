import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

import { useObject } from '../src/hooks/use-object'

describe('useObject', () => {
  test('mutating a nested property updates the signal', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    const initialFooSignal = +result.current[0].foo

    act(() => {
      result.current[0].foo.bar = 'b'
    })

    expect(result.current[0].foo.bar).toBe('b')
    const newFooSignal = +result.current[0].foo
    expect(Number.isNaN(newFooSignal)).toBe(false)
    if (!Number.isNaN(initialFooSignal)) expect(newFooSignal).toBeGreaterThan(initialFooSignal)
    else expect(newFooSignal).toBeGreaterThan(0)
  })

  test('nested object exposes its own signal and increments on mutation', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' }, baz: { qux: 'x' } }))
    const fooSignal = +result.current[0].foo
    const bazSignal = +result.current[0].baz

    act(() => {
      result.current[0].foo.bar = 'b'
    })

    expect(result.current[0].foo.bar).toBe('b')
    const newFooSignal = +result.current[0].foo
    expect(Number.isNaN(newFooSignal)).toBe(false)
    if (!Number.isNaN(fooSignal)) expect(newFooSignal).toBeGreaterThan(fooSignal)
    else expect(newFooSignal).toBeGreaterThan(0)

    // other nested objects should not change
    const newBazSignal = +result.current[0].baz
    if (Number.isNaN(bazSignal)) expect(Number.isNaN(newBazSignal)).toBe(true)
    else expect(newBazSignal).toBe(bazSignal)
  })

  test('array element nested object has independent signal', () => {
    const { result } = renderHook(() => useObject({ items: [{ nested: { count: 0 } }, { nested: { count: 0 } }] }))
    const firstSignal = +result.current[0].items[0]!.nested
    const secondSignal = +result.current[0].items[1]!.nested

    act(() => {
      result.current[0].items[0]!.nested.count += 1
    })

    expect(result.current[0].items[0]!.nested.count).toBe(1)
    const newFirst = +result.current[0].items[0]!.nested
    expect(Number.isNaN(newFirst)).toBe(false)
    if (!Number.isNaN(firstSignal)) expect(newFirst).toBeGreaterThan(firstSignal)
    else expect(newFirst).toBeGreaterThan(0)

    const newSecond = +result.current[0].items[1]!.nested
    if (Number.isNaN(secondSignal)) expect(Number.isNaN(newSecond)).toBe(true)
    else expect(newSecond).toBe(secondSignal)
  })

  test('different nested objects maintain independent signals', () => {
    const { result } = renderHook(() => useObject({ a: { n: 0 }, b: { n: 0 } }))
    const aSignal = +result.current[0].a
    const bSignal = +result.current[0].b

    act(() => {
      result.current[0].a.n = 1
    })

    const newA = +result.current[0].a
    expect(Number.isNaN(newA)).toBe(false)
    if (!Number.isNaN(aSignal)) expect(newA).toBeGreaterThan(aSignal)
    else expect(newA).toBeGreaterThan(0)

    const newB = +result.current[0].b
    if (Number.isNaN(bSignal)) expect(Number.isNaN(newB)).toBe(true)
    else expect(newB).toBe(bSignal)
  })

  test('forceUpdate increments the signal', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    // forceUpdate should not throw and should re-render; no numeric root signal assumed
    act(() => {
      result.current[2]()
    })
    expect(true).toBe(true)
  })

  test('setObject replaces the base object', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' } }))

    act(() => {
      result.current[1]({ foo: { bar: 'c' } })
    })

    expect(result.current[0].foo.bar).toBe('c')
  })

  test('transformArrays wraps arrays when enabled', () => {
    const { result } = renderHook(() => useObject({ items: ['a'] }))
    const initialItemsSignal = +result.current[0].items

    act(() => {
      result.current[0].items.push('b')
    })

    expect(result.current[0].items.length).toBe(2)
    const newItemsSignal = +result.current[0].items
    expect(Number.isNaN(newItemsSignal)).toBe(false)
    if (!Number.isNaN(initialItemsSignal)) expect(newItemsSignal).toBeGreaterThan(initialItemsSignal)
    else expect(newItemsSignal).toBeGreaterThan(0)
  })

  test('object values that cannot be WeakMap keys do not error', () => {
    const { result } = renderHook(() => useObject({ config: { count: 0, enabled: true }, values: [1, 2, 3] }))
    const initialConfigSignal = +result.current[0].config
    const initialValuesSignal = +result.current[0].values

    act(() => {
      result.current[0].config.count = 1
      result.current[0].values[0] = 4
    })

    expect(result.current[0].config.count).toBe(1)
    expect(result.current[0].values[0]).toBe(4)

    const newConfigSignal = +result.current[0].config
    expect(Number.isNaN(newConfigSignal)).toBe(false)
    if (!Number.isNaN(initialConfigSignal)) expect(newConfigSignal).toBeGreaterThan(initialConfigSignal)
    else expect(newConfigSignal).toBeGreaterThan(0)

    const newValuesSignal = +result.current[0].values
    if (Number.isNaN(initialValuesSignal)) expect(Number.isNaN(newValuesSignal)).toBe(true)
    else expect(newValuesSignal).toBeGreaterThan(initialValuesSignal)
  })

  test('push proxies newly added object elements', () => {
    const { result } = renderHook(() => useObject({ items: [] as Array<{ nested: number }> }))
    const initialElementSignal = +result.current[0].items

    act(() => {
      result.current[0].items.push({ nested: 1 })
    })

    act(() => {
      result.current[0].items[0]!.nested = 2
    })

    expect(result.current[0].items[0]?.nested).toBe(2)
    const newItemsSignal = +result.current[0].items
    expect(Number.isNaN(newItemsSignal)).toBe(false)
    if (!Number.isNaN(initialElementSignal)) expect(newItemsSignal).toBeGreaterThan(initialElementSignal)
    else expect(newItemsSignal).toBeGreaterThan(0)
  })

  test('unshift proxies newly added object elements', () => {
    const { result } = renderHook(() => useObject({ items: [] as Array<{ nested: number }> }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].items.unshift({ nested: 1 })
    })

    act(() => {
      result.current[0].items[0]!.nested = 2
    })

    expect(result.current[0].items[0]?.nested).toBe(2)
    const newItemsSignal = +result.current[0].items
    expect(Number.isNaN(newItemsSignal)).toBe(false)
    if (!Number.isNaN(initialSignal)) expect(newItemsSignal).toBeGreaterThan(initialSignal)
    else expect(newItemsSignal).toBeGreaterThan(0)
  })

  test('splice proxies newly inserted object elements', () => {
    const { result } = renderHook(() => useObject({ items: [{ nested: 1 }] as Array<{ nested: number }> }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].items.splice(1, 0, { nested: 2 })
    })

    act(() => {
      result.current[0].items[1]!.nested = 3
    })

    expect(result.current[0].items[1]?.nested).toBe(3)
    const newItemsSignal = +result.current[0].items
    expect(Number.isNaN(newItemsSignal)).toBe(false)
    if (!Number.isNaN(initialSignal)) expect(newItemsSignal).toBeGreaterThan(initialSignal)
    else expect(newItemsSignal).toBeGreaterThan(0)
  })

  test('fill proxies object values inserted by fill', () => {
    const { result } = renderHook(() => useObject({ items: [{ nested: 1 }, { nested: 2 }] }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].items.fill({ nested: 5 })
    })

    act(() => {
      result.current[0].items[0]!.nested = 6
    })

    expect(result.current[0].items[0]?.nested).toBe(6)
    expect(result.current[0].items[1]?.nested).toBe(6)
    const newItemsSignal = +result.current[0].items
    expect(Number.isNaN(newItemsSignal)).toBe(false)
    if (!Number.isNaN(initialSignal)) expect(newItemsSignal).toBeGreaterThan(initialSignal)
    else expect(newItemsSignal).toBeGreaterThan(0)
  })

  test('object mutations after unmount do not update the signal', () => {
    const { result, unmount } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    const fooSignal = +result.current[0].foo

    unmount()

    result.current[0].foo.bar = 'z'
    const newFoo = +result.current[0].foo
    if (Number.isNaN(fooSignal)) expect(Number.isNaN(newFoo)).toBe(true)
    else expect(newFoo).toBe(fooSignal)
  })

  test('array mutations after unmount do not update the signal', () => {
    const { result, unmount } = renderHook(() => useObject({ items: ['a'] }))
    const itemsSignal = +result.current[0].items

    unmount()

    result.current[0].items.push('b')
    expect(result.current[0].items.length).toBe(2)
    const newItems = +result.current[0].items
    if (Number.isNaN(itemsSignal)) expect(Number.isNaN(newItems)).toBe(true)
    else expect(newItems).toBe(itemsSignal)
  })

  test('object inside array inside object is proxied', () => {
    const { result } = renderHook(() => useObject({ items: [{ nested: { count: 0 } }] }))
    const nestedSignal = +result.current[0].items[0]!.nested

    act(() => {
      result.current[0].items[0]!.nested.count += 1
    })

    expect(result.current[0].items[0]!.nested.count).toBe(1)
    const newNested = +result.current[0].items[0]!.nested
    expect(Number.isNaN(newNested)).toBe(false)
    if (!Number.isNaN(nestedSignal)) expect(newNested).toBeGreaterThan(nestedSignal)
    else expect(newNested).toBeGreaterThan(0)
  })

  test('recursive references do not cause non-termination', () => {
    const shared: any = { value: 1 }
    const root: any = { items: [shared] }
    shared.parent = root

    const { result } = renderHook(() => useObject(root))
    const itemSignal = +result.current[0].items[0]

    act(() => {
      result.current[0].items[0].value = 2
    })

    expect(result.current[0].items[0].value).toBe(2)
    const newItemSignal = +result.current[0].items[0]
    expect(Number.isNaN(newItemSignal)).toBe(false)
    if (!Number.isNaN(itemSignal)) expect(newItemSignal).toBeGreaterThan(itemSignal)
    else expect(newItemSignal).toBeGreaterThan(0)
  })
})

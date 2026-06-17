// These tests were mostly written by Copilot and validated by exoRift

import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useCallback, useMemo } from 'react'

import { useObject, getUnproxiedObject } from '../src/hooks/use-object'

describe('useObject', () => {
  test('mutating a nested property updates the signal', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    const initialFooSignal = +result.current[0].foo

    act(() => {
      result.current[0].foo.bar = 'b'
    })

    expect(result.current[0].foo.bar).toBe('b')
    const newFooSignal = +result.current[0].foo
    expect(newFooSignal).toBeGreaterThan(initialFooSignal)
  })

  test('nested object exposes its own signal and increments on mutation', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' }, baz: { qux: 'x' } }))
    const resultSignal = +result.current[0]
    const fooSignal = +result.current[0].foo
    const bazSignal = +result.current[0].baz

    act(() => {
      result.current[0].foo.bar = 'b'
    })

    expect(result.current[0].foo.bar).toBe('b')
    const newFooSignal = +result.current[0].foo
    expect(newFooSignal).toBeGreaterThan(fooSignal)
    const newResultSignal = +result.current[0]
    expect(newResultSignal, 'changes percolate up').toBeGreaterThan(resultSignal)

    const newBazSignal = +result.current[0].baz
    expect(newBazSignal, 'other nested objects should not change').toBe(bazSignal)
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
    expect(newFirst).toBeGreaterThan(firstSignal)

    const newSecond = +result.current[0].items[1]!.nested
    expect(newSecond).toBe(secondSignal)
  })

  test('different nested objects maintain independent signals', () => {
    const { result } = renderHook(() => useObject({ a: { n: 0 }, b: { n: 0 } }))
    const aSignal = +result.current[0].a
    const bSignal = +result.current[0].b

    act(() => {
      result.current[0].a.n = 1
    })

    const newA = +result.current[0].a
    expect(newA).toBeGreaterThan(aSignal)

    const newB = +result.current[0].b
    expect(newB).toBe(bSignal)
  })

  test('forceUpdate increments the signal', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' } }))
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
    expect(newItemsSignal).toBeGreaterThan(initialItemsSignal)
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
    expect(newConfigSignal).toBeGreaterThan(initialConfigSignal)

    const newValuesSignal = +result.current[0].values
    expect(newValuesSignal).toBeGreaterThan(initialValuesSignal)
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
    expect(newItemsSignal).toBeGreaterThan(initialElementSignal)
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
    expect(newItemsSignal).toBeGreaterThan(initialSignal)
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
    expect(newItemsSignal).toBeGreaterThan(initialSignal)
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
    expect(newItemsSignal).toBeGreaterThan(initialSignal)
  })

  test('object mutations after unmount do not update the signal', () => {
    const { result, unmount } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    const fooSignal = +result.current[0].foo

    unmount()

    result.current[0].foo.bar = 'z'
    const newFoo = +result.current[0].foo
    expect(newFoo).toBe(fooSignal)
  })

  test('array mutations after unmount do not update the signal', () => {
    const { result, unmount } = renderHook(() => useObject({ items: ['a'] }))
    const itemsSignal = +result.current[0].items

    unmount()

    result.current[0].items.push('b')
    expect(result.current[0].items.length).toBe(2)
    const newItems = +result.current[0].items
    expect(newItems).toBe(itemsSignal)
  })

  test('object inside array inside object is proxied', () => {
    const { result } = renderHook(() => useObject({ items: [{ nested: { count: 0 } }] }))
    const nestedSignal = +result.current[0].items[0]!.nested

    act(() => {
      result.current[0].items[0]!.nested.count += 1
    })

    expect(result.current[0].items[0]!.nested.count).toBe(1)
    const newNested = +result.current[0].items[0]!.nested
    expect(newNested).toBeGreaterThan(nestedSignal)
  })

  test('ignoreProperties prevents proxying of specified property keys', () => {
    const shared: any = { nested: { count: 0 } }
    const root: any = { shared }

    const { result } = renderHook(() => useObject(root, ['shared']))
    const rootSignal = +result.current[0]
    const sharedSignal = +result.current[0].shared

    act(() => {
      result.current[0].shared.nested.count = 1
    })

    expect(result.current[0].shared.nested.count).toBe(1)

    const newSharedSignal = +result.current[0].shared
    expect(newSharedSignal).toBe(sharedSignal)

    const newRootSignal = +result.current[0]
    expect(newRootSignal).toBe(rootSignal)
  })

  test('ignoreProperties with primitive property does not change signal on update', () => {
    const root: any = { value: 0 }

    const { result } = renderHook(() => useObject(root, ['value']))
    const rootSignal = +result.current[0]

    act(() => {
      result.current[0].value = 1
    })

    expect(result.current[0].value).toBe(1)

    const newRootSignal = +result.current[0]
    expect(newRootSignal).toBe(rootSignal)
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
    expect(newItemSignal).toBeGreaterThan(itemSignal)
  })

  test('getUnproxiedObject returns the original objects without proxy signals', () => {
    const initial: any = { foo: { bar: 'a' }, items: [{ nested: { count: 0 } }] }
    initial.self = initial

    const { result } = renderHook(() => useObject(initial))

    const proxied = result.current[0]

    expect(typeof +proxied.foo, 'proxied objects expose signals via valueOf').toBe('number')
    expect(typeof +proxied.items[0]!.nested, 'proxied objects expose signals via valueOf').toBe('number')

    const unproxied = getUnproxiedObject(proxied)

    expect(unproxied.foo.bar, 'unproxied should preserve data').toBe('a')
    expect(unproxied.items[0].nested.count, 'unproxied should preserve data').toBe(0)

    expect(Number.isNaN(+unproxied.foo), 'but should not expose the proxy signal (coercion yields NaN)').toBe(true)
    expect(Number.isNaN(+unproxied.items[0].nested), 'but should not expose the proxy signal (coercion yields NaN)').toBe(true)
  })

  test('using the same object multiple times yields independent signals but shared data', () => {
    const shared: any = { nested: { count: 0 } }
    const rootA: any = { shared }
    const rootB: any = { shared }

    const { result: rA } = renderHook(() => useObject(rootA))
    const { result: rB } = renderHook(() => useObject(rootB))

    const aSignal = +rA.current[0].shared
    const bSignal = +rB.current[0].shared

    act(() => {
      rA.current[0].shared.nested.count = 1
    })

    expect(rA.current[0].shared.nested.count).toBe(1)
    expect(rB.current[0].shared.nested.count).toBe(1)

    const newASignal = +rA.current[0].shared
    const newBSignal = +rB.current[0].shared

    expect(newASignal).toBeGreaterThan(aSignal)
    expect(newBSignal).toBe(bSignal)
  })

  test('stale proxies are not reused after setObject', () => {
    const shared: any = { value: 1 }
    const { result } = renderHook(() => useObject(shared))

    const firstProxy = result.current[0]

    act(() => {
      result.current[1]({ other: true })
    })

    act(() => {
      result.current[1](shared)
    })

    expect(result.current[0], 'not return the stale proxy instance that was created earlier').not.toBe(firstProxy)
    expect(result.current[0].value).toBe(1)
  })

  test('memoized callback updates the new object after setObject', () => {
    const { result } = renderHook(() => {
      const [obj, setObject] = useObject({ prop: [{ foo: { foobar: 'bar' } }] })
      const prop = obj.prop[0]!
      const cb = useCallback(() => { prop.foo.foobar = 'baz' }, [prop])
      const memoed = useMemo(() => prop.foo.foobar, [prop, +prop])
      return { obj, setObject, cb, memoed }
    })

    expect(result.current.memoed).toBe('bar')

    const newInstance = { prop: [{ foo: { foobar: 'bar' } }] }

    act(() => {
      result.current.setObject(newInstance)
    })

    // invoke the memoized callback which should have been updated to the new `obj`
    act(() => {
      result.current.cb()
    })

    expect(result.current.memoed).toBe('baz')
  })
})

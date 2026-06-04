import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

import { useObject } from '../src/hooks/use-object'

describe('useObject', () => {
  test('mutating a nested property updates the signal', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].foo.bar = 'b'
    })

    expect(result.current[0].foo.bar).toBe('b')
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
  })

  test('forceUpdate increments the signal', () => {
    const { result } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[2]()
    })

    expect(+result.current[0]).toBeGreaterThan(initialSignal)
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
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].items.push('b')
    })

    expect(result.current[0].items.length).toBe(2)
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
  })

  test('object values that cannot be WeakMap keys do not error', () => {
    const { result } = renderHook(() => useObject({ config: { count: 0, enabled: true }, values: [1, 2, 3] }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].config.count = 1
      result.current[0].values[0] = 4
    })

    expect(result.current[0].config.count).toBe(1)
    expect(result.current[0].values[0]).toBe(4)
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
  })

  test('push proxies newly added object elements', () => {
    const { result } = renderHook(() => useObject({ items: [] as Array<{ nested: number }> }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].items.push({ nested: 1 })
    })

    act(() => {
      result.current[0].items[0]!.nested = 2
    })

    expect(result.current[0].items[0]?.nested).toBe(2)
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
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
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
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
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
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
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
  })

  test('object mutations after unmount do not update the signal', () => {
    const { result, unmount } = renderHook(() => useObject({ foo: { bar: 'a' } }))
    const initialSignal = +result.current[0]

    unmount()

    result.current[0].foo.bar = 'z'
    expect(+result.current[0]).toBe(initialSignal)
  })

  test('array mutations after unmount do not update the signal', () => {
    const { result, unmount } = renderHook(() => useObject({ items: ['a'] }))
    const initialSignal = +result.current[0]

    unmount()

    result.current[0].items.push('b')
    expect(result.current[0].items.length).toBe(2)
    expect(+result.current[0]).toBe(initialSignal)
  })

  test('object inside array inside object is proxied', () => {
    const { result } = renderHook(() => useObject({ items: [{ nested: { count: 0 } }] }))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].items[0]!.nested.count += 1
    })

    expect(result.current[0].items[0]!.nested.count).toBe(1)
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
  })

  test('recursive references do not cause non-termination', () => {
    const shared: any = { value: 1 }
    const root: any = { items: [shared] }
    shared.parent = root

    const { result } = renderHook(() => useObject(root))
    const initialSignal = +result.current[0]

    act(() => {
      result.current[0].items[0].value = 2
    })

    expect(result.current[0].items[0].value).toBe(2)
    expect(+result.current[0]).toBeGreaterThan(initialSignal)
  })
})

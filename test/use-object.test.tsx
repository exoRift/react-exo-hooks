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

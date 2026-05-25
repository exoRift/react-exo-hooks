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
})

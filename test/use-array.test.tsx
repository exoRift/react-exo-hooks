import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'

import { StatefulArray, useArray } from '../src/hooks/use-array'

describe('useArray', () => {
  test('instance is array', () => {
    expect(Array.isArray(new StatefulArray())).toBe(true)
  })

  test('push and pop update the signal', () => {
    const { result } = renderHook(() => useArray<string>())
    const initialSignal = +result.current

    act(() => {
      result.current.push('a')
    })

    expect(result.current.length).toBe(1)
    expect(+result.current).toBeGreaterThan(initialSignal)

    act(() => {
      result.current.pop()
    })

    expect(result.current.length).toBe(0)
    expect(+result.current).toBeGreaterThan(initialSignal)
  })

  test('reset replaces the instance', async () => {
    const { result } = renderHook(() => useArray<string>(['a']))
    const original = result.current

    act(() => {
      result.current.reset(['x', 'y'])
    })

    await waitFor(() => expect(result.current).not.toBe(original))
    expect(Array.from(result.current)).toEqual(['x', 'y'])
  })

  test('bracket access assignment updates the signal', async () => {
    const { result } = renderHook(() => useArray([0]))
    const initialSignal = +result.current

    act(() => {
      result.current[0] = 2
    })

    await waitFor(() => expect(result.current[0]).toBe(2))
    expect(+result.current).not.toBe(initialSignal)
  })
})

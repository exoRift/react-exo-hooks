import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'

import { useArray } from '../src/hooks/use-array'

describe('useArray', () => {
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
})

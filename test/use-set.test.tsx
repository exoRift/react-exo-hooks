import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSet } from '../src/hooks/use-set'

describe('useSet', () => {
  test('add and delete update size and signal', () => {
    const { result } = renderHook(() => useSet<string>())

    act(() => {
      result.current.add('a')
    })

    expect(result.current.has('a')).toBe(true)
    expect(+result.current).toBe(1)

    act(() => {
      result.current.delete('a')
    })

    expect(result.current.has('a')).toBe(false)
    expect(+result.current).toBe(0)
  })

  test('toggle flips membership', () => {
    const { result } = renderHook(() => useSet<string>())

    act(() => {
      result.current.toggle('x')
    })

    expect(result.current.has('x')).toBe(true)

    act(() => {
      result.current.toggle('x')
    })

    expect(result.current.has('x')).toBe(false)
  })

  test('reset replaces the instance', async () => {
    const { result } = renderHook(() => useSet<string>(['a']))
    const original = result.current

    act(() => {
      result.current.reset(['b', 'c'])
    })

    await waitFor(() => expect(result.current).not.toBe(original))
    expect(Array.from(result.current)).toEqual(['b', 'c'])
  })
})

import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'

import { useSet } from '../src/hooks/use-set'

describe('useSet', () => {
  test('add and delete update size and signal', () => {
    const { result } = renderHook(() => useSet<string>())
    const initialSignal = +result.current

    act(() => {
      result.current.add('a')
    })

    const nextSignal = +result.current

    expect(result.current.has('a')).toBe(true)
    expect(result.current.size).toBe(1)
    expect(nextSignal).not.toBe(initialSignal)

    act(() => {
      result.current.delete('a')
    })

    expect(result.current.has('a')).toBe(false)
    expect(+result.current).not.toBe(initialSignal)
    expect(+result.current).not.toBe(nextSignal)
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
    const original = +result.current

    act(() => {
      result.current.reset(['b', 'c'])
    })

    await waitFor(() => expect(+result.current).not.toBe(original))
    expect(Array.from(result.current)).toEqual(['b', 'c'])
  })

  test('symmetricDifference works', async () => {
    const { result } = renderHook(() => useSet<string>(['a']))
    expect(Array.from(result.current.symmetricDifference(new Set(['b'])))).toEqual(['a', 'b'])
  })
})

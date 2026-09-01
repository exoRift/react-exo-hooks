import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useCallback } from 'react'

import { useSet } from '../src/hooks/use-set'

describe('useSet', () => {
  test('add and delete update size and reference', () => {
    const { result } = renderHook(() => useSet<string>())
    const initial = result.current

    act(() => {
      result.current.add('a')
    })

    const afterAdd = result.current

    expect(result.current.has('a')).toBe(true)
    expect(result.current.size).toBe(1)
    expect(afterAdd).not.toBe(initial)

    act(() => {
      result.current.delete('a')
    })

    expect(result.current.has('a')).toBe(false)
    expect(result.current).not.toBe(initial)
    expect(result.current).not.toBe(afterAdd)
  })

  test('toggle flips membership', () => {
    const { result } = renderHook(() => useSet<string>())
    let toggled: boolean | undefined

    act(() => {
      toggled = result.current.toggle('x')
    })

    expect(result.current.has('x')).toBe(true)
    expect(toggled, 'toggle returns the new state').toBe(true)

    act(() => {
      toggled = result.current.toggle('x')
    })

    expect(result.current.has('x')).toBe(false)
    expect(toggled, 'toggle returns the new state').toBe(false)
  })

  test('reset replaces the contents', async () => {
    const { result } = renderHook(() => useSet<string>(['a']))
    const original = result.current

    act(() => {
      result.current.reset(['b', 'c'])
    })

    await waitFor(() => expect(result.current).not.toBe(original))
    expect(Array.from(result.current)).toEqual(['b', 'c'])
  })

  test('symmetricDifference works', async () => {
    const { result } = renderHook(() => useSet<string>(['a']))
    expect(Array.from(result.current.symmetricDifference(new Set(['b'])))).toEqual(['a', 'b'])
  })

  test('redundant writes keep the reference', () => {
    const { result } = renderHook(() => useSet<string>(['a']))
    const initial = result.current

    act(() => {
      result.current.add('a')
      result.current.delete('b')
    })

    expect(result.current, 'nothing changed').toBe(initial)
  })

  test('the writer is a constant reference', () => {
    const { result, rerender } = renderHook(() => useSet<string>(['a']))
    const writer = result.current.writer

    act(() => {
      result.current.add('b')
    })

    act(() => {
      result.current.reset(['c'])
    })

    rerender()

    expect(result.current, 'the proxy changed').not.toBe(writer)
    expect(result.current.writer, 'the writer did not').toBe(writer)
    expect(writer.writer, 'the writer is its own writer').toBe(writer)
  })

  test('writing through the writer updates without invalidating memos on it', () => {
    const { result } = renderHook(() => {
      const set = useSet<string>()

      return {
        set,
        callback: useCallback(() => set.writer.add('a'), [set.writer])
      }
    })

    const initialSet = result.current.set
    const initialCallback = result.current.callback

    act(() => {
      result.current.callback()
    })

    expect(result.current.set.has('a'), 'the write went through').toBe(true)
    expect(result.current.set, 'the set rerendered').not.toBe(initialSet)
    expect(result.current.callback, 'the callback was not recomputed').toBe(initialCallback)
  })

  test('methods are reference-stable and chain onto the proxy', () => {
    const { result } = renderHook(() => useSet<string>())
    const initial = result.current

    expect(Reflect.get(result.current, 'has'), 'repeat accesses are equal').toBe(Reflect.get(result.current, 'has'))

    let chained: unknown
    act(() => {
      chained = initial.add('a')
    })

    expect(chained, 'add returns the proxy it was called on').toBe(initial)
    expect(chained, 'and not the raw writer').not.toBe(result.current.writer)
  })
})

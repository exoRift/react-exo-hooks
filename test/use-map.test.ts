import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useCallback } from 'react'

import { useMap } from '../src/hooks/use-map'

describe('useMap', () => {
  test('set and delete update the reference', () => {
    const { result } = renderHook(() => useMap<string, number>())
    const initial = result.current

    act(() => {
      result.current.set('a', 1)
    })

    const afterSet = result.current

    expect(result.current.get('a')).toBe(1)
    expect(result.current.size).toBe(1)
    expect(afterSet).not.toBe(initial)

    act(() => {
      result.current.delete('a')
    })

    expect(result.current.has('a')).toBeFalse()
    expect(result.current).not.toBe(initial)
    expect(result.current).not.toBe(afterSet)
  })

  test('bulkSet inserts items', () => {
    const { result } = renderHook(() => useMap<string, { id: string }>())
    const initial = result.current

    act(() => {
      result.current.bulkSet([{ id: 'x' }, { id: 'y' }], 'id')
    })

    expect(result.current.get('x')?.id).toBe('x')
    expect(result.current.get('y')?.id).toBe('y')
    expect(result.current, 'reference updated').not.toBe(initial)
  })

  test('reset replaces the contents', () => {
    const { result } = renderHook(() => useMap<string, number>([['a', 1]]))
    const original = result.current

    act(() => {
      result.current.reset(new Map([['b', 2]]))
    })

    expect(result.current).not.toBe(original)
    expect(result.current.has('a')).toBeFalse()
    expect(result.current.get('b')).toBe(2)
  })

  test('redundant writes keep the reference', () => {
    const { result } = renderHook(() => useMap<string, number>([['a', 1]]))
    const initial = result.current

    act(() => {
      result.current.set('a', 1)
      result.current.delete('b')
    })

    expect(result.current, 'nothing changed').toBe(initial)
  })

  test('the writer is a constant reference', () => {
    const { result, rerender } = renderHook(() => useMap<string, number>([['a', 1]]))
    const writer = result.current.writer

    act(() => {
      result.current.set('b', 2)
    })

    act(() => {
      result.current.reset([['c', 3]])
    })

    rerender()

    expect(result.current, 'the proxy changed').not.toBe(writer)
    expect(result.current.writer, 'the writer did not').toBe(writer)
    expect(writer.writer, 'the writer is its own writer').toBe(writer)
  })

  test('writing through the writer updates without invalidating memos on it', () => {
    const { result } = renderHook(() => {
      const map = useMap<string, number>()

      return {
        map,
        callback: useCallback(() => map.writer.set('a', (map.writer.get('a') ?? 0) + 1), [map.writer])
      }
    })

    const initialMap = result.current.map
    const initialCallback = result.current.callback

    act(() => {
      result.current.callback()
    })

    expect(result.current.map.get('a'), 'the write went through').toBe(1)
    expect(result.current.map, 'the map rerendered').not.toBe(initialMap)
    expect(result.current.callback, 'the callback was not recomputed').toBe(initialCallback)
  })

  test('methods are reference-stable and chain onto the proxy', () => {
    const { result } = renderHook(() => useMap<string, number>())
    const initial = result.current

    expect(Reflect.get(result.current, 'get'), 'repeat accesses are equal').toBe(Reflect.get(result.current, 'get'))

    let chained: unknown
    act(() => {
      chained = initial.set('a', 1)
    })

    expect(chained, 'set returns the proxy it was called on').toBe(initial)
    expect(chained, 'and not the raw writer').not.toBe(result.current.writer)
  })
})

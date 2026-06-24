import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

import { useMap } from '../src/hooks/use-map'

describe('useMap', () => {
  test('set and delete update the signal', () => {
    const { result } = renderHook(() => useMap<string, number>())
    const initialSignal = +result.current

    act(() => {
      result.current.set('a', 1)
    })

    const nextSignal = +result.current

    expect(result.current.get('a')).toBe(1)
    expect(result.current.size).toBe(1)
    expect(nextSignal).not.toBe(initialSignal)

    act(() => {
      result.current.delete('a')
    })

    expect(result.current.has('a')).toBeFalse()
    expect(+result.current).not.toBe(initialSignal)
    expect(+result.current).not.toBe(nextSignal)
  })

  test('bulkSet inserts items', () => {
    const { result } = renderHook(() => useMap<string, { id: string }>())
    const initialSignal = +result.current

    act(() => {
      result.current.bulkSet([{ id: 'x' }, { id: 'y' }], 'id')
    })

    expect(result.current.get('x')?.id).toBe('x')
    expect(result.current.get('y')?.id).toBe('y')
    expect(+result.current, 'signal updated').not.toBe(initialSignal)
  })

  test('reset replaces the instance', () => {
    const { result } = renderHook(() => useMap<string, number>([['a', 1]]))
    const original = +result.current

    act(() => {
      result.current.reset(new Map([['b', 2]]))
    })

    expect(+result.current).not.toBe(original)
    expect(result.current.get('b')).toBe(2)
  })
})

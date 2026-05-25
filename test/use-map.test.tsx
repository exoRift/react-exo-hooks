import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useMap } from '../src/hooks/use-map'

describe('useMap', () => {
  test('set and delete update the signal', () => {
    const { result } = renderHook(() => useMap<string, number>())
    const initialSignal = +result.current

    act(() => {
      result.current.set('a', 1)
    })

    expect(result.current.get('a')).toBe(1)
    expect(+result.current).toBeGreaterThan(initialSignal)

    act(() => {
      result.current.delete('a')
    })

    expect(result.current.has('a')).toBe(false)
  })

  test('bulkSet inserts items', () => {
    const { result } = renderHook(() => useMap<string, { id: string }>())

    act(() => {
      result.current.bulkSet([{ id: 'x' }, { id: 'y' }], 'id')
    })

    expect(result.current.get('x')?.id).toBe('x')
    expect(result.current.get('y')?.id).toBe('y')
  })

  test('reset replaces the instance', async () => {
    const { result } = renderHook(() => useMap<string, number>([['a', 1]]))
    const original = result.current

    act(() => {
      result.current.reset(new Map([['b', 2]]))
    })

    await waitFor(() => expect(result.current).not.toBe(original))
    expect(result.current.get('b')).toBe(2)
  })
})

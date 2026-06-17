import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

import { useArrayMemo } from '../src/hooks/use-array-memo'
import { useState } from 'react'

describe('useDebouncedState', () => {
  test('debounces updates', async () => {
    const first = [1, 2, 3]
    const { result } = renderHook(() => {
      const [raw, setRaw] = useState(first)
      const memoed = useArrayMemo(raw)

      return { setRaw, memoed }
    })

    act(() => {
      result.current.setRaw([1, 2, 3])
    })
    expect(result.current.memoed).toBe(first)

    const second = [1, 2]
    act(() => {
      result.current.setRaw(second)
    })
    expect(result.current.memoed).toBe(second)

    const third = [1, 3]
    act(() => {
      result.current.setRaw(third)
    })
    expect(result.current.memoed).toBe(third)
  })
})

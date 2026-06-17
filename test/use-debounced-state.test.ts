import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'

import { useDebouncedState } from '../src/hooks/use-debounced-state'

describe('useDebouncedState', () => {
  test('debounces updates', async () => {
    const { result } = renderHook(() => useDebouncedState('a', 20))

    act(() => {
      result.current[1]('b')
    })

    expect(result.current[2]).toBe('b')
    expect(result.current[0]).toBe('a')

    await waitFor(() => expect(result.current[0]).toBe('b'))
  })
})

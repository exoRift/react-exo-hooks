import { describe, expect, test } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'

import { usePromise } from '../src/hooks/use-promise'

describe('usePromise', () => {
  test('resolves a promise', async () => {
    const { result } = renderHook(() =>
      usePromise(() => () => Promise.resolve('ok'), [])
    )

    expect(result.current.state).toBe('waiting')
    await waitFor(() => expect(result.current.state).toBe('resolved'))
    expect(result.current.result).toBe('ok')
  })

  test('rejects a promise', async () => {
    const { result } = renderHook(() =>
      usePromise(() => () => Promise.reject(new Error('boom')), [])
    )

    await waitFor(() => expect(result.current.state).toBe('rejected'))
    expect(result.current.error).toBeInstanceOf(Error)
  })

  test('persists prior values when requested', async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => usePromise(() => () => Promise.resolve(id), [id], true),
      { initialProps: { id: 1 } }
    )

    await waitFor(() => expect(result.current.state).toBe('resolved'))
    expect(result.current.result).toBe(1)

    rerender({ id: 2 })
    expect(result.current.state).toBe('waiting')
    expect(result.current.result).toBe(1)

    await waitFor(() => expect(result.current.state).toBe('resolved'))
    expect(result.current.result).toBe(2)
  })
})

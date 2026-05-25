import { describe, expect, test } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'
import { useUnsaved } from '../src/hooks/use-unsaved'

type RouteHandler = (url: string) => void

interface MockRouter {
  pathname: string
  events: {
    on: (event: string, handler: RouteHandler) => void
    off: (event: string, handler: RouteHandler) => void
  }
  _emit: (event: string, url: string) => void
}

/**
 * Create a mock NextJS router
 * @param pathname The current router pathname
 * @returns        The mock router
 */
function createMockRouter (pathname: string): MockRouter {
  const handlers = new Map<string, RouteHandler>()

  return {
    pathname,
    events: {
      on: (event, handler) => {
        handlers.set(event, handler)
      },
      off: (event, handler) => {
        const current = handlers.get(event)
        if (current === handler) handlers.delete(event)
      }
    },
    _emit: (event, url) => {
      handlers.get(event)?.(url)
    }
  }
}

describe('useUnsaved', () => {
  test('blocks route changes and beforeunload', async () => {
    const router = createMockRouter('/posts/[id]')

    const originalConfirm = globalThis.confirm
    globalThis.confirm = () => false

    let beforeUnloadHandler: ((e: Event) => void) | undefined
    const originalAdd = window.addEventListener
    const originalRemove = window.removeEventListener

    window.addEventListener = (type: any, handler: any, options: any) => {
      if (type === 'beforeunload') beforeUnloadHandler = handler
      return originalAdd.call(window, type, handler, options)
    }

    window.removeEventListener = (type: any, handler: any, options: any) => {
      if (type === 'beforeunload' && beforeUnloadHandler === handler) beforeUnloadHandler = undefined
      return originalRemove.call(window, type, handler, options)
    }

    const { unmount } = renderHook(() => useUnsaved(true, router as any))

    await waitFor(() => expect(beforeUnloadHandler).toBeDefined())

    let prevented = false
    const event = new Event('beforeunload')
    const originalPrevent = event.preventDefault.bind(event)
    event.preventDefault = () => {
      prevented = true
      originalPrevent()
    }

    beforeUnloadHandler?.(event)
    expect(prevented).toBe(true)

    expect(() => router._emit('routeChangeStart', '/posts/123')).not.toThrow()
    expect(() => router._emit('routeChangeStart', '/other')).toThrow()

    unmount()
    expect(beforeUnloadHandler).toBeUndefined()

    window.addEventListener = originalAdd
    window.removeEventListener = originalRemove
    globalThis.confirm = originalConfirm
  })
})

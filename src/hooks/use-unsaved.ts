import { useEffect } from 'react'
import type { NextRouter, useRouter } from 'next/router'

/**
 * Don't let a user navigate or close the page if changes aren't saved
 * @param unsaved    Are there unsaved changes?
 * @param nextRouter If using NextJS, the next router instance or hook (prevents NextJS navigation)
 */
export function useUnsaved (unsaved?: boolean, nextRouter?: NextRouter | typeof useRouter): void {
  const router = typeof nextRouter === 'function' ? nextRouter() : nextRouter

  useEffect(() => {
    if (unsaved) {
      /**
       * If the tab is closed with unsaved changes
       */
      function preventUnsavedClose (e: Event): void {
        e.preventDefault()
      }

      /**
       * If a Next.JS SPA nav is started with unsaved changes
       * @param          url The new URL (to check if simply changing page props rather than a page)
       * @throws {Error}     To prevent page navigation
       */
      function preventUnsavedNav (url: string): void {
        const urlSplit = url.split('?')[0]!.split('/')
        if (router?.pathname.split('/').every((subroute, i) => (subroute.startsWith('[') && subroute.endsWith(']')) || subroute === urlSplit[i])) return

        if (!confirm('Changes you made may not be saved.')) throw new Error('Navigation Canceled')
      }

      router?.events.on('routeChangeStart', preventUnsavedNav)
      window.addEventListener('beforeunload', preventUnsavedClose)
      return () => {
        router?.events.off('routeChangeStart', preventUnsavedNav)
        window.removeEventListener('beforeunload', preventUnsavedClose)
      }
    }
  }, [unsaved])
}

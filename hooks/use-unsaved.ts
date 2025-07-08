import { useEffect } from 'react'
import type { Router } from 'next/router'

/**
 * Don't let a user navigate or close the page if changes aren't saved
 * @param unsaved    Are there unsaved changes?
 * @param nextRouter If using NextJS, the next router (prevents NextJS navigation)
 */
export function useUnsaved (unsaved?: boolean, nextRouter?: Router): void {
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
        if (nextRouter?.pathname.split('/').every((subroute, i) => (subroute.startsWith('[') && subroute.endsWith(']')) || subroute === urlSplit[i])) return

        if (!confirm('Changes you made may not be saved.')) throw new Error('Navigation Canceled')
      }

      nextRouter?.events.on('routeChangeStart', preventUnsavedNav)
      window.addEventListener('beforeunload', preventUnsavedClose)
      return () => {
        nextRouter?.events.off('routeChangeStart', preventUnsavedNav)
        window.removeEventListener('beforeunload', preventUnsavedClose)
      }
    }
  }, [unsaved])
}

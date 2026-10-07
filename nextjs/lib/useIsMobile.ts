'use client'

// lib/useIsMobile.ts — reports whether the viewport is a narrow, portrait phone.
// Returns false during SSR / first paint, then updates on mount and on resize so
// components can branch to touch-friendly layouts without hydration mismatches.
//
// We require BOTH a narrow width AND portrait orientation: in landscape the phone
// is wide enough to fall back to the (more robust) desktop layout instead of the
// cramped portrait one.

import { useEffect, useState } from 'react'

/** Mobile = below the `md` breakpoint (768px) AND in portrait orientation. */
export function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px) and (orientation: portrait)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    // Also listen to resize/orientationchange as a fallback for environments that
    // don't reliably fire the media-query `change` event.
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [breakpointPx])

  return isMobile
}
